import { Injectable, Logger } from '@nestjs/common';

import { In } from 'typeorm';

import {
  type ContactEmailStatus,
  LeadEnrichmentService,
} from './lead-enrichment.service';
import {
  extractPeopleFromHtml,
  hasForeignAffiliation,
  type ExtractedPerson,
  mergePeople,
} from '../utils/team-page-extraction.util';
import { normalizeDomain } from '../utils/lead-candidate.util';
import { getRegistrableDomain } from '../utils/registrable-domain.util';
import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';

export const MAX_BULK_COMPANIES = 10;

const BULK_CONCURRENCY = 3;
const PAGE_CONCURRENCY = 4;
const MAX_PAGES = 10;
const MAX_DISCOVERED_LINKS = 4;
const MAX_PEOPLE = 40;
const FETCH_TIMEOUT_MS = 8_000;

const CANDIDATE_PATHS = [
  '/about',
  '/about-us',
  '/team',
  '/our-team',
  '/company',
  '/leadership',
  '/contact',
];

const GERMAN_PATHS = ['/impressum', '/ueber-uns', '/team'];

const BOT_CHALLENGE_PATTERN =
  /<title>\s*(checking your browser|just a moment|attention required|access denied|verify you are human)/i;

const NAME_EMAIL_TEMPLATES: ((first: string, last: string) => string)[] = [
  (first, last) => `${first}.${last}`,
  (first, last) => `${first}${last}`,
  (first, last) => `${first}_${last}`,
  (first, last) => `${first}-${last}`,
  (first, last) => `${first[0]}.${last}`,
  (first, last) => `${first[0]}${last}`,
  (first, last) => `${last}.${first}`,
];

export type DiscoveredContact = {
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle?: string;
  linkedinUrl?: string;
  email?: string;
  emailStatus?: ContactEmailStatus;
  emailVerification?: string;
  emailSource?: string;
  sourceUrl: string;
  method: ExtractedPerson['method'];
};

export type CompanyContactsResult = {
  website: string;
  domain: string;
  pagesFetched: string[];
  people: DiscoveredContact[];
  companyEmails: string[];
  emailPattern?: string;
  smtp: 'available' | 'unavailable' | 'unknown' | 'not-run';
  notes: string[];
};

export type BulkCompanyContactsResult = {
  companyId: string;
  companyName?: string;
  status: 'ok' | 'not-found' | 'no-website' | 'error';
  error?: string;
} & Partial<CompanyContactsResult>;

const asciiToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^a-z]/g, '');

export const splitName = (fullName: string) => {
  const words = fullName.trim().split(/\s+/);

  return {
    firstName: words[0] ?? '',
    lastName: words.slice(1).join(' '),
  };
};

export const emailMatchesName = (email: string, fullName: string) => {
  const words = fullName.trim().split(/\s+/);
  const first = asciiToken(words[0] ?? '');
  const last = asciiToken(words[words.length - 1] ?? '');
  const local = email.split('@')[0];

  return (
    words.length >= 2 &&
    !!first &&
    !!last &&
    NAME_EMAIL_TEMPLATES.some((template) => template(first, last) === local)
  );
};

export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;

  const run = async () => {
    while (next < items.length) {
      const index = next;

      next += 1;
      results[index] = await worker(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));

  return results;
};

const toWebsiteUrl = (value: string | undefined) => {
  const raw = value?.trim();

  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    );

    return /^https?:$/.test(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
};

@Injectable()
export class ContactDiscoveryService {
  private readonly logger = new Logger(ContactDiscoveryService.name);

  constructor(
    private readonly secureHttpClientService: SecureHttpClientService,
    private readonly leadEnrichmentService: LeadEnrichmentService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
  ) {}

  async discoverCompanyContacts(
    website: string,
    options: { verifyEmails?: boolean } = {},
  ): Promise<CompanyContactsResult> {
    const baseUrl = toWebsiteUrl(website);

    if (!baseUrl) {
      throw new Error(`Not a valid website: ${website}`);
    }

    const origin = baseUrl.origin;
    const domain = getRegistrableDomain(baseUrl.hostname);
    const notes: string[] = [];
    const pagesFetched: string[] = [];
    const extracted: ExtractedPerson[] = [];
    const emails = new Set<string>();

    const homepageUrl = `${origin}/`;
    const homepage = await this.fetchHtml(homepageUrl);
    const queue: string[] = [];

    if (homepage) {
      pagesFetched.push(homepageUrl);
      const page = extractPeopleFromHtml(homepage, homepageUrl);

      extracted.push(...page.people);
      page.emails.forEach((email) => emails.add(email));
      queue.push(...page.teamLinks.slice(0, MAX_DISCOVERED_LINKS));
    } else {
      notes.push('Homepage could not be fetched (blocked or offline).');
    }

    const isGerman =
      /\.(de|at|ch)$/.test(domain) ||
      /<html[^>]+lang=["']de/i.test(homepage?.slice(0, 2000) ?? '');

    queue.push(
      ...CANDIDATE_PATHS.map((path) => `${origin}${path}`),
      ...(isGerman ? GERMAN_PATHS.map((path) => `${origin}${path}`) : []),
    );

    const urls = [
      ...new Set(queue.map((url) => url.replace(/\/+$/, ''))),
    ].filter((url) => url !== origin);
    const pages = urls.slice(0, MAX_PAGES - 1);

    const htmlByUrl = await mapWithConcurrency(
      pages,
      PAGE_CONCURRENCY,
      async (url) => ({ url, html: await this.fetchHtml(url) }),
    );

    for (const { url, html } of htmlByUrl) {
      if (!html) {
        continue;
      }

      pagesFetched.push(url);
      const page = extractPeopleFromHtml(html, url);

      extracted.push(...page.people);
      page.emails.forEach((email) => emails.add(email));
    }

    const people = mergePeople(extracted)
      .filter((person) => !hasForeignAffiliation(person.jobTitle, domain))
      .slice(0, MAX_PEOPLE);
    const siteEmails = [...emails];
    const claimedEmails = new Set(
      people.map((person) => person.email).filter(Boolean),
    );

    for (const person of people) {
      if (person.email) {
        continue;
      }

      const match = siteEmails.find(
        (email) =>
          !claimedEmails.has(email) && emailMatchesName(email, person.name),
      );

      if (match) {
        person.email = match;
        claimedEmails.add(match);
      }
    }

    const resolution = await this.leadEnrichmentService.resolveContactEmails({
      domain,
      siteEmails,
      people: people.map((person) => ({
        name: person.name,
        ...(person.email ? { email: person.email } : {}),
      })),
      ...(options.verifyEmails === false ? { verify: false } : {}),
    });

    if (!resolution && people.length > 0) {
      notes.push(
        'Lead engine unavailable: only emails shown on the website are returned, no guessed or verified emails.',
      );
    }

    if (resolution?.smtp === 'unavailable') {
      notes.push(
        'Email verification unavailable (outbound port 25 is blocked on this network): guessed emails are unconfirmed.',
      );
    }

    const contacts: DiscoveredContact[] = people.map((person, index) => {
      const resolved = resolution?.people[index];
      const email = resolved?.email ?? person.email;
      const emailStatus =
        resolved?.emailStatus ?? (person.email ? 'found' : undefined);

      return {
        ...splitName(person.name),
        fullName: person.name,
        jobTitle: person.jobTitle,
        linkedinUrl: person.linkedinUrl,
        email: email ?? undefined,
        emailStatus: email ? emailStatus : undefined,
        emailVerification: resolved?.verification ?? undefined,
        emailSource:
          emailStatus === 'found'
            ? person.sourceUrl
            : (resolved?.emailSource ?? undefined),
        sourceUrl: person.sourceUrl,
        method: person.method,
      };
    });

    return {
      website: origin,
      domain,
      pagesFetched,
      people: contacts,
      companyEmails: siteEmails.filter((email) => !claimedEmails.has(email)),
      emailPattern: resolution?.pattern ?? undefined,
      smtp: resolution?.smtp ?? 'not-run',
      notes,
    };
  }

  async discoverForCompanyIds(
    workspaceId: string,
    companyIds: string[],
  ): Promise<BulkCompanyContactsResult[]> {
    const ids = [...new Set(companyIds)].slice(0, MAX_BULK_COMPANIES);

    const companies = await this.workspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = this.workspaceOrmManager.getRepository(
          CompanyWorkspaceEntity,
          { shouldBypassPermissionChecks: true },
        );

        return repository.find({ where: { id: In(ids) } });
      },
      buildSystemAuthContext(workspaceId),
    );

    const byId = new Map(companies.map((company) => [company.id, company]));

    return mapWithConcurrency(ids, BULK_CONCURRENCY, async (companyId) => {
      const company = byId.get(companyId);

      if (!company) {
        return { companyId, status: 'not-found' as const };
      }

      const companyName = company.name ?? undefined;
      const website = company.domainName?.primaryLinkUrl;

      if (!normalizeDomain(website ?? undefined)) {
        return { companyId, companyName, status: 'no-website' as const };
      }

      try {
        const result = await this.discoverCompanyContacts(website as string);

        return { companyId, companyName, status: 'ok' as const, ...result };
      } catch (error) {
        return {
          companyId,
          companyName,
          status: 'error' as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const safeFetch = this.secureHttpClientService.createSsrfSafeFetch({
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: 3_000_000,
      });
      const response = await safeFetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType && !/html|xml/i.test(contentType)) {
        return null;
      }

      const html = await response.text();

      return BOT_CHALLENGE_PATTERN.test(html.slice(0, 5000)) ? null : html;
    } catch (error) {
      this.logger.debug(`Failed to fetch ${url}: ${error}`);

      return null;
    }
  }
}
