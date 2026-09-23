import { Injectable, Logger } from '@nestjs/common';

import { parsePhoneNumberWithError } from 'libphonenumber-js';
import {
  type ActorMetadata,
  FieldActorSource,
  type PhonesMetadata,
} from 'twenty-shared/types';
import { emailSchema } from 'twenty-shared/utils';

import { type ContactEmailStatus } from './lead-enrichment.service';
import {
  ContactDiscoveryService,
  type DiscoveredContact,
} from './contact-discovery.service';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { addPersonEmailFiltersToQueryBuilder } from 'src/modules/match-participant/utils/add-person-email-filters-to-query-builder';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export type PersonEmailStatus = 'FOUND' | 'GUESSED' | 'VERIFIED' | 'INVALID';

export type ContactToSave = {
  firstName: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  emailStatus?: ContactEmailStatus;
  otherEmails?: string[];
  phone?: string;
  linkedinUrl?: string;
  leadSource?: string;
};

export type SavedPersonResult = {
  id?: string;
  name: string;
  jobTitle?: string;
  email?: string;
  emailStatus?: ContactEmailStatus;
  saved: boolean;
  reason?: string;
};

export type SaveContactsResult = {
  created: number;
  skipped: number;
  people: SavedPersonResult[];
};

export type CompanySaveContactsResult = SaveContactsResult & {
  companyId: string;
  companyName?: string;
  error?: string;
};

const SAVABLE_EMAIL_STATUSES = new Set<ContactEmailStatus>([
  'found',
  'verified',
]);

const PERSON_EMAIL_STATUS: Record<ContactEmailStatus, PersonEmailStatus> = {
  found: 'FOUND',
  guessed: 'GUESSED',
  verified: 'VERIFIED',
  invalid: 'INVALID',
};

const LEAD_ENGINE_ACTOR_NAME = 'Lead engine';

const isValidEmail = (value: string | undefined): value is string =>
  !!value && emailSchema.safeParse(value).success;

export const normalizeEmail = (value: string | undefined) =>
  value?.trim().toLowerCase() || undefined;

export const normalizePersonName = (value: string | undefined) =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const toPersonEmailStatus = (
  status: ContactEmailStatus | undefined,
): PersonEmailStatus | null => (status ? PERSON_EMAIL_STATUS[status] : null);

// A missing status means the email was supplied directly, so it counts as found.
export const resolveEmailStatus = (
  email: string | undefined,
  status: ContactEmailStatus | undefined,
): ContactEmailStatus | undefined =>
  isValidEmail(email) ? (status ?? 'found') : undefined;

export const savablePrimaryEmail = (
  email: string | undefined,
  status: ContactEmailStatus | undefined,
): string | undefined => {
  const normalized = normalizeEmail(email);
  const resolved = resolveEmailStatus(normalized, status);

  return resolved && SAVABLE_EMAIL_STATUSES.has(resolved)
    ? normalized
    : undefined;
};

export const toInternationalPhone = (value: string | undefined) => {
  const raw = value?.replace(/[^\d+]/g, '');

  if (!raw || !/^\+\d{7,15}$/.test(raw)) {
    return undefined;
  }

  try {
    const parsed = parsePhoneNumberWithError(raw);

    if (!parsed.isValid() || !parsed.country) {
      return undefined;
    }

    const phones: PhonesMetadata = {
      primaryPhoneNumber: parsed.nationalNumber,
      primaryPhoneCountryCode: parsed.country,
      primaryPhoneCallingCode: `+${parsed.countryCallingCode}`,
      additionalPhones: [],
    };

    return phones;
  } catch {
    return undefined;
  }
};

export const leadSourceFromUrl = (sourceUrl: string | undefined) => {
  const path = (() => {
    try {
      return new URL(sourceUrl ?? '').pathname.toLowerCase();
    } catch {
      return '';
    }
  })();

  if (path.includes('impressum') || path.includes('imprint')) {
    return 'Impressum';
  }

  if (path.includes('contact') || path.includes('kontakt')) {
    return 'Website contact page';
  }

  if (path === '' || path === '/') {
    return 'Website homepage';
  }

  return 'Website team page';
};

export const toContactToSave = (contact: DiscoveredContact): ContactToSave => ({
  firstName: contact.firstName,
  lastName: contact.lastName,
  jobTitle: contact.jobTitle,
  email: contact.email,
  emailStatus: contact.emailStatus,
  linkedinUrl: contact.linkedinUrl,
  leadSource:
    contact.method === 'impressum'
      ? 'Impressum'
      : leadSourceFromUrl(contact.sourceUrl),
});

export const buildPersonRecord = (
  contact: ContactToSave,
  companyId: string | undefined,
  defaultLeadSource: string,
  createdBy?: ActorMetadata,
): Partial<PersonWorkspaceEntity> => {
  const email = savablePrimaryEmail(contact.email, contact.emailStatus);
  const emailStatus = resolveEmailStatus(
    normalizeEmail(contact.email),
    contact.emailStatus,
  );
  const otherEmails = email
    ? [
        ...new Set(
          (contact.otherEmails ?? [])
            .map(normalizeEmail)
            .filter(
              (value): value is string =>
                isValidEmail(value) && value !== email,
            ),
        ),
      ]
    : [];
  const phones = toInternationalPhone(contact.phone);
  const linkedinUrl = contact.linkedinUrl?.trim();

  const record: Partial<PersonWorkspaceEntity> = {
    name: {
      firstName: contact.firstName.trim(),
      lastName: contact.lastName?.trim() ?? '',
    },
    jobTitle: contact.jobTitle?.trim() || null,
    emailStatus: toPersonEmailStatus(emailStatus),
    leadSource: contact.leadSource?.trim() || defaultLeadSource,
    createdBy: createdBy ?? {
      source: FieldActorSource.SYSTEM,
      workspaceMemberId: null,
      name: LEAD_ENGINE_ACTOR_NAME,
      context: {},
    },
  };

  if (email) {
    record.emails = {
      primaryEmail: email,
      additionalEmails: otherEmails.length > 0 ? otherEmails : null,
    };
  }

  if (phones) {
    record.phones = phones;
  }

  if (linkedinUrl && /^https?:\/\//i.test(linkedinUrl)) {
    record.linkedinLink = {
      primaryLinkUrl: linkedinUrl,
      primaryLinkLabel: '',
      secondaryLinks: [],
    };
  }

  if (companyId) {
    record.companyId = companyId;
  }

  return record;
};

const fullNameOf = (contact: ContactToSave) =>
  [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();

@Injectable()
export class ContactPersistenceService {
  private readonly logger = new Logger(ContactPersistenceService.name);

  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly contactDiscoveryService: ContactDiscoveryService,
  ) {}

  async discoverAndSaveForCompanyIds(
    workspaceId: string,
    companyIds: string[],
  ): Promise<CompanySaveContactsResult[]> {
    const discovered = await this.contactDiscoveryService.discoverForCompanyIds(
      workspaceId,
      companyIds,
    );
    const results: CompanySaveContactsResult[] = [];

    for (const company of discovered) {
      const base = {
        companyId: company.companyId,
        ...(company.companyName && { companyName: company.companyName }),
      };

      if (company.status !== 'ok') {
        results.push({
          ...base,
          created: 0,
          skipped: 0,
          people: [],
          error:
            company.status === 'not-found'
              ? 'Company not found'
              : company.status === 'no-website'
                ? 'Company has no website'
                : (company.error ?? 'Contact discovery failed'),
        });
        continue;
      }

      try {
        const saved = await this.saveContacts({
          workspaceId,
          companyId: company.companyId,
          contacts: (company.people ?? []).map(toContactToSave),
          defaultLeadSource: 'Website',
        });

        results.push({ ...base, ...saved });
      } catch (error) {
        results.push({
          ...base,
          created: 0,
          skipped: 0,
          people: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  async saveContacts({
    workspaceId,
    companyId,
    contacts,
    defaultLeadSource,
    createdBy,
  }: {
    workspaceId: string;
    companyId?: string;
    contacts: ContactToSave[];
    defaultLeadSource: string;
    createdBy?: ActorMetadata;
  }): Promise<SaveContactsResult> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository = this.workspaceOrmManager.getRepository(
        PersonWorkspaceEntity,
        { shouldBypassPermissionChecks: true },
      );

      const candidateEmails = [
        ...new Set(
          contacts
            .map((contact) =>
              savablePrimaryEmail(contact.email, contact.emailStatus),
            )
            .filter((email): email is string => !!email),
        ),
      ];

      const existingByEmail =
        candidateEmails.length > 0
          ? await addPersonEmailFiltersToQueryBuilder({
              queryBuilder: repository.createQueryBuilder('person'),
              emails: candidateEmails,
            }).getMany<PersonWorkspaceEntity>()
          : [];

      const takenEmails = new Set<string>(
        existingByEmail.flatMap((person) =>
          [
            person.emails?.primaryEmail,
            ...(Array.isArray(person.emails?.additionalEmails)
              ? (person.emails.additionalEmails as string[])
              : []),
          ]
            .map((email) => normalizeEmail(email ?? undefined))
            .filter((email): email is string => !!email),
        ),
      );

      const companyPeople = companyId
        ? await repository.find({ where: { companyId } })
        : [];

      const takenNames = new Set(
        companyPeople
          .map((person) =>
            normalizePersonName(
              [person.name?.firstName, person.name?.lastName]
                .filter(Boolean)
                .join(' '),
            ),
          )
          .filter(Boolean),
      );

      let position = ((await repository.maximum('position', undefined)) ??
        0) as number;

      const people: SavedPersonResult[] = [];

      for (const contact of contacts) {
        const name = fullNameOf(contact);
        const email = normalizeEmail(contact.email);
        const emailStatus = resolveEmailStatus(email, contact.emailStatus);
        const result: SavedPersonResult = {
          name,
          ...(contact.jobTitle && { jobTitle: contact.jobTitle }),
          ...(emailStatus && { email }),
          ...(emailStatus && { emailStatus }),
          saved: false,
        };
        const primaryEmail = savablePrimaryEmail(email, contact.emailStatus);
        const normalizedName = normalizePersonName(name);

        if (!contact.firstName?.trim()) {
          people.push({ ...result, reason: 'Missing name' });
          continue;
        }

        if (primaryEmail && takenEmails.has(primaryEmail)) {
          people.push({
            ...result,
            reason: 'A person with this email already exists',
          });
          continue;
        }

        if (companyId && normalizedName && takenNames.has(normalizedName)) {
          people.push({
            ...result,
            reason: 'A person with this name already exists at this company',
          });
          continue;
        }

        try {
          position += 1;
          const inserted = await repository.insert({
            ...buildPersonRecord(
              contact,
              companyId,
              defaultLeadSource,
              createdBy,
            ),
            position,
          });
          const id = (inserted.raw as { id?: string }[] | undefined)?.[0]?.id;

          if (primaryEmail) {
            takenEmails.add(primaryEmail);
          }

          if (companyId && normalizedName) {
            takenNames.add(normalizedName);
          }

          people.push({ ...result, ...(id && { id }), saved: true });
        } catch (error) {
          this.logger.warn(`Could not save person ${name}: ${error}`);
          people.push({
            ...result,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        created: people.filter((person) => person.saved).length,
        skipped: people.filter((person) => !person.saved).length,
        people,
      };
    }, buildSystemAuthContext(workspaceId));
  }
}
