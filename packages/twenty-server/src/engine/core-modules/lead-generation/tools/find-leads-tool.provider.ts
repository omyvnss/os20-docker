import { Injectable } from '@nestjs/common';

import { ToolCategory } from 'twenty-shared/ai';
import { z } from 'zod';

import { normalizeDomain } from 'src/engine/core-modules/lead-generation/utils/lead-candidate.util';
import { ContactDiscoveryService } from 'src/engine/core-modules/lead-generation/services/contact-discovery.service';
import {
  type ContactToSave,
  ContactPersistenceService,
} from 'src/engine/core-modules/lead-generation/services/contact-persistence.service';
import { LeadGenerationService } from 'src/engine/core-modules/lead-generation/services/lead-generation.service';
import { CreateRecordService } from 'src/engine/core-modules/record-crud/services/create-record.service';
import { FindRecordsService } from 'src/engine/core-modules/record-crud/services/find-records.service';
import { toToolJsonSchema } from 'src/engine/core-modules/record-crud/utils/to-tool-json-schema.util';
import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

const findLeadsSchema = z.object({
  request: z
    .string()
    .describe(
      'What kind of companies to find, in the user\'s words, e.g. "B2B SaaS tools for dental clinics"',
    ),
  industry: z.string().optional().describe('Industry, e.g. "SaaS"'),
  location: z
    .string()
    .optional()
    .describe('City, region or country, e.g. "Berlin"'),
  count: z.coerce
    .number()
    .optional()
    .describe('How many leads to return (default 10, max 25)'),
  saveToCrm: z
    .boolean()
    .optional()
    .describe('Save the leads as Companies in the CRM (default true)'),
});

const MAX_CONTACTS = 25;

const saveContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        firstName: z.string().describe('First name'),
        lastName: z.string().optional().describe('Last name'),
        jobTitle: z.string().optional().describe('Role, e.g. "Head of Sales"'),
        email: z.string().optional().describe('Best email found'),
        emailStatus: z
          .enum(['found', 'guessed', 'verified', 'invalid'])
          .optional()
          .describe(
            'emailStatus from find_company_contacts. Only found or verified emails are saved.',
          ),
        otherEmails: z.array(z.string()).optional(),
        phone: z.string().optional().describe('Best phone number found'),
        linkedinUrl: z.string().optional(),
        companyName: z.string().optional(),
        companyDomain: z
          .string()
          .optional()
          .describe('Company website domain, e.g. "salesforce.com"'),
      }),
    )
    .describe('People to save, max 25 per call'),
});

const findCompanyContactsSchema = z.object({
  website: z.string().describe('Company website or domain, e.g. "acme.com"'),
  verifyEmails: z
    .boolean()
    .optional()
    .describe('Check guessed emails over SMTP (default true)'),
});

const SAVABLE_EMAIL_STATUSES = new Set(['found', 'verified']);

type SaveContact = z.infer<typeof saveContactsSchema>['contacts'][number];

type SavingContext = ToolProviderContext & {
  authContext: NonNullable<ToolProviderContext['authContext']>;
};

@Injectable()
export class FindLeadsToolProvider implements ToolProvider {
  readonly category: ToolCategory = ToolCategory.LEAD_GENERATION;

  constructor(
    private readonly leadGenerationService: LeadGenerationService,
    private readonly createRecordService: CreateRecordService,
    private readonly findRecordsService: FindRecordsService,
    private readonly contactDiscoveryService: ContactDiscoveryService,
    private readonly contactPersistenceService: ContactPersistenceService,
  ) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateDescriptors(): Promise<ToolDescriptor[]> {
    return [
      {
        name: 'find_leads',
        label: 'Find Leads',
        description:
          'Find real companies on the internet that match a description (industry, location, what they do), score them by fit, and save them as Companies in the CRM. Uses the workspace Google Places key first when saved, then the web search key (Firecrawl, Tavily, Brave, SerpAPI) or DuckDuckGo, and the workspace AI key for scoring. Returns name, website, score, reason, emails and phone per lead.',
        category: this.category,
        executionRef: { kind: 'static', toolId: 'find_leads' },
        inputSchema: toToolJsonSchema(findLeadsSchema),
      },
      {
        name: 'find_company_contacts',
        label: 'Find Company Team',
        description:
          'Read a company website (homepage, about, team, leadership, contact, impressum) and list the real people shown there: name, job title, LinkedIn URL and email. Each email has emailStatus: found (shown on the site), verified (mail server accepted it, not catch-all), guessed (built from the name and the domain email pattern, unconfirmed) or invalid. Use it when the user wants people or decision makers at a known company, then pass the people to save_contacts with their emailStatus.',
        category: this.category,
        executionRef: { kind: 'static', toolId: 'find_company_contacts' },
        inputSchema: toToolJsonSchema(findCompanyContactsSchema),
      },
      {
        name: 'save_contacts',
        label: 'Save Contacts to CRM',
        description:
          'Save people you found (name, job title, email, phone, LinkedIn) as People in the CRM, each linked to their company. Finds the company by domain or creates it. Skips people whose email is already in the CRM. Use this after find_contact or web_search whenever the user wants people or contact details collected.',
        category: this.category,
        executionRef: { kind: 'static', toolId: 'save_contacts' },
        inputSchema: toToolJsonSchema(saveContactsSchema),
      },
    ];
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    if (toolName === 'save_contacts') {
      return this.saveContacts(args, context);
    }

    if (toolName === 'find_company_contacts') {
      return this.findCompanyContacts(args);
    }

    const parsed = findLeadsSchema.safeParse(args);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid find_leads arguments',
        error: parsed.error.message,
      };
    }

    const { request, industry, location, count, saveToCrm } = parsed.data;
    const shouldSave = saveToCrm !== false && !!context.authContext;

    try {
      const { leads, stats, hints } =
        await this.leadGenerationService.findLeads({
          keywords: request.split(/[,\s]+/).filter((word) => word.length > 2),
          industry,
          location,
          maxResults: count ?? 10,
        });

      let saved = 0;
      let alreadyInCrm = 0;
      const recordReferences: NonNullable<ToolOutput['recordReferences']> = [];

      if (shouldSave && context.authContext) {
        const savingContext = context as SavingContext;

        for (const lead of leads) {
          const domain = normalizeDomain(lead.domain ?? lead.companyUrl);
          const existingId = await this.findCompanyId(
            domain,
            lead.company,
            savingContext,
          );

          if (existingId) {
            alreadyInCrm += 1;
            lead.crmCompanyId = existingId;
            continue;
          }

          const created = await this.createRecordService.execute({
            objectName: 'company',
            objectRecord: {
              name: lead.company,
              ...(domain && {
                domainName: {
                  // Same form as manually added companies so duplicates are caught.
                  primaryLinkUrl: `https://${domain}`,
                  primaryLinkLabel: '',
                  secondaryLinks: [],
                },
              }),
            },
            authContext: context.authContext,
            rolePermissionConfig: context.rolePermissionConfig,
            createdBy: context.actorContext,
            slimResponse: true,
          });

          if (created.success) {
            saved += 1;
            lead.crmCompanyId = (created.result as { id: string }).id;
            recordReferences.push(...(created.recordReferences ?? []));
          } else if (
            /duplicate|unique|already exists/i.test(created.error ?? '')
          ) {
            alreadyInCrm += 1;
          }
        }
      }

      const savedSummary = shouldSave
        ? `; saved ${saved} to the CRM${alreadyInCrm > 0 ? `, ${alreadyInCrm} already there` : ''}`
        : '';

      return {
        success: true,
        message: `Found ${leads.length} lead(s) in ${Math.round(stats.durationMs / 1000)}s${savedSummary}.`,
        result: {
          leads: leads.map((lead) => ({
            name: lead.company,
            website: lead.companyUrl || undefined,
            source: lead.source,
            rating: lead.rating,
            score: lead.score,
            reason: lead.reason,
            emails: lead.emails,
            phone: lead.phone,
            location: lead.location === 'Unknown' ? undefined : lead.location,
            description: lead.description?.slice(0, 160),
            crmCompanyId: lead.crmCompanyId,
          })),
          stats,
          hints,
        },
        recordReferences,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Lead search failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async saveContacts(
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const parsed = saveContactsSchema.safeParse(args);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid save_contacts arguments',
        error: parsed.error.message,
      };
    }

    if (!context.authContext) {
      return {
        success: false,
        message: 'Saving contacts needs a signed-in workspace',
        error: 'Missing auth context',
      };
    }

    const savingContext = context as SavingContext;

    const recordReferences: NonNullable<ToolOutput['recordReferences']> = [];
    const companyIds = new Map<string, string>();
    const saved: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    const withheldEmails: {
      name: string;
      email: string;
      emailStatus?: string;
    }[] = [];
    const contactsByCompany = new Map<string | undefined, ContactToSave[]>();

    for (const contact of parsed.data.contacts.slice(0, MAX_CONTACTS)) {
      const fullName = [contact.firstName, contact.lastName]
        .filter(Boolean)
        .join(' ');
      const candidateEmail = contact.email?.trim().toLowerCase();

      if (
        candidateEmail &&
        contact.emailStatus &&
        !SAVABLE_EMAIL_STATUSES.has(contact.emailStatus)
      ) {
        withheldEmails.push({
          name: fullName,
          email: candidateEmail,
          emailStatus: contact.emailStatus,
        });
      }

      const companyId = await this.resolveCompanyId(
        contact,
        companyIds,
        savingContext,
        recordReferences,
      );
      const group = contactsByCompany.get(companyId) ?? [];

      group.push({
        firstName: contact.firstName,
        lastName: contact.lastName,
        jobTitle: contact.jobTitle,
        email: contact.email,
        emailStatus: contact.emailStatus,
        otherEmails: contact.otherEmails,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
      });
      contactsByCompany.set(companyId, group);
    }

    for (const [companyId, contacts] of contactsByCompany) {
      try {
        const result = await this.contactPersistenceService.saveContacts({
          workspaceId: context.workspaceId,
          companyId,
          contacts,
          defaultLeadSource: 'Ask AI',
          createdBy: context.actorContext,
        });

        for (const person of result.people) {
          if (person.saved) {
            saved.push(person.name);

            if (person.id) {
              recordReferences.push({
                objectNameSingular: 'person',
                recordId: person.id,
                displayName: person.name,
              });
            }
          } else if (person.reason?.includes('already exists')) {
            skipped.push(person.name);
          } else {
            failed.push(`${person.name}: ${person.reason ?? 'not saved'}`);
          }
        }
      } catch (error) {
        failed.push(
          ...contacts.map(
            (contact) =>
              `${[contact.firstName, contact.lastName].filter(Boolean).join(' ')}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }

    return {
      success: failed.length === 0 || saved.length > 0,
      message: `Saved ${saved.length} contact(s) to People${skipped.length > 0 ? `, ${skipped.length} already there` : ''}${failed.length > 0 ? `, ${failed.length} failed` : ''}${withheldEmails.length > 0 ? `; ${withheldEmails.length} unconfirmed email(s) not saved` : ''}.`,
      result: { saved, skipped, failed, withheldEmails },
      recordReferences,
    };
  }

  private async findCompanyContacts(
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    const parsed = findCompanyContactsSchema.safeParse(args);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid find_company_contacts arguments',
        error: parsed.error.message,
      };
    }

    try {
      const result = await this.contactDiscoveryService.discoverCompanyContacts(
        parsed.data.website,
        { verifyEmails: parsed.data.verifyEmails },
      );
      const counts = result.people.reduce<Record<string, number>>(
        (acc, person) => {
          const key = person.emailStatus ?? 'none';

          acc[key] = (acc[key] ?? 0) + 1;

          return acc;
        },
        {},
      );
      const countSummary = Object.entries(counts)
        .filter(([key]) => key !== 'none')
        .map(([key, value]) => `${value} ${key}`)
        .join(', ');

      return {
        success: true,
        message:
          result.people.length === 0
            ? `No people listed on ${result.domain} (${result.pagesFetched.length} page(s) read).`
            : `Found ${result.people.length} people on ${result.domain}${countSummary ? ` (emails: ${countSummary})` : ''}. Guessed emails are unconfirmed and are not saved as primary email.`,
        result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Company contact discovery failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Matches by domain (with or without www) when known, else by exact name.
  private async findCompanyId(
    domain: string | undefined,
    name: string | undefined,
    context: SavingContext,
  ): Promise<string | undefined> {
    const trimmedName = name?.trim();

    if (!domain && !trimmedName) {
      return undefined;
    }

    const found = await this.findRecordsService.execute({
      objectName: 'company',
      filter: domain
        ? {
            or: [
              { domainName: { primaryLinkUrl: { ilike: `%//${domain}` } } },
              { domainName: { primaryLinkUrl: { ilike: `%//${domain}/%` } } },
              { domainName: { primaryLinkUrl: { ilike: `%//www.${domain}` } } },
              {
                domainName: { primaryLinkUrl: { ilike: `%//www.${domain}/%` } },
              },
            ],
          }
        : { name: { ilike: trimmedName } },
      limit: 1,
      shouldBuildEffectiveSelectFields: false,
      authContext: context.authContext,
      rolePermissionConfig: context.rolePermissionConfig,
    });

    return found.success
      ? (found.result?.records[0] as { id: string } | undefined)?.id
      : undefined;
  }

  private async resolveCompanyId(
    contact: SaveContact,
    cache: Map<string, string>,
    context: SavingContext,
    recordReferences: NonNullable<ToolOutput['recordReferences']>,
  ): Promise<string | undefined> {
    const domain = normalizeDomain(contact.companyDomain);
    const key = domain ?? contact.companyName?.trim().toLowerCase();

    if (!key) {
      return undefined;
    }

    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const existingId = await this.findCompanyId(
      domain,
      contact.companyName,
      context,
    );

    if (existingId) {
      cache.set(key, existingId);

      return existingId;
    }

    const created = await this.createRecordService.execute({
      objectName: 'company',
      objectRecord: {
        name: contact.companyName?.trim() || domain,
        ...(domain && {
          domainName: {
            primaryLinkUrl: `https://${domain}`,
            primaryLinkLabel: '',
            secondaryLinks: [],
          },
        }),
      },
      authContext: context.authContext,
      rolePermissionConfig: context.rolePermissionConfig,
      createdBy: context.actorContext,
      slimResponse: true,
    });

    if (!created.success) {
      return undefined;
    }

    const id = (created.result as { id: string }).id;

    cache.set(key, id);
    recordReferences.push(...(created.recordReferences ?? []));

    return id;
  }
}
