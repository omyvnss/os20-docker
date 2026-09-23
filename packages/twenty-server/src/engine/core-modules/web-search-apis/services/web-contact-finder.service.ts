import { Injectable, Logger } from '@nestjs/common';

import { WebSearchToolService } from './web-search-tool.service';
import { WebScrapeToolService } from './web-scrape-tool.service';

export type ContactSource = {
  url: string;
  title: string;
  emails: string[];
  phones: string[];
};

export type ContactFindInput = {
  name: string;
  company?: string;
  role?: string;
  domain?: string;
};

export type ContactFindResult = {
  name: string;
  company: string;
  emails: string[];
  phones: string[];
  generated: string[];
  sources: ContactSource[];
};

const MAX_SCRAPES = 8;
const MAX_QUERIES = 4;
const JUNK_DOMAINS = /example|sentry|wixpress|cloudflare|googleusercontent|schema|yourdomain|no-reply|donotreply/i;
const FREE_MAIL_DOMAINS =
  /(gmail|yahoo|hotmail|outlook|protonmail|icloud|aol\.com|live\.com|msn\.|yandex|zoho|rediffmail|me\.com|hey\.com)/i;
const LISTING_HOSTS =
  /(facebook|instagram|linkedin|twitter\.com|x\.com|youtube|rocketreach|clay\.com|shortlyst|foundersmail|pissedconsumer|zoominfo|apollo\.io|signalhire|hunter\.io|crunchbase)/i;

@Injectable()
export class WebContactFinderService {
  private readonly logger = new Logger(WebContactFinderService.name);

  constructor(
    private readonly searchService: WebSearchToolService,
    private readonly scrapeService: WebScrapeToolService,
  ) {}

  async find(input: ContactFindInput): Promise<ContactFindResult> {
    const name = input.name.trim();
    const company = (input.company ?? '').trim();

    const queries = this.buildQueries(name, company, input.role);
    const uniqueUrls: string[] = [];
    const queryErrors: string[] = [];

    // Stage 1 — search multiple query variants
    for (const query of queries.slice(0, MAX_QUERIES)) {
      try {
        const results = await this.searchService.search(query, 5);

        for (const r of results) {
          if (!uniqueUrls.includes(r.url)) {
            uniqueUrls.push(r.url);
          }
        }
      } catch (error) {
        queryErrors.push(
          `${query}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Stage 2 — scrape the top pages and extract emails / phones
    const sources: ContactSource[] = [];
    const emails = new Map<string, string>();
    const phones = new Set<string>();

    for (const url of uniqueUrls.slice(0, MAX_SCRAPES)) {
      try {
        const scraped = await this.scrapeService.scrape(url);

        sources.push({
          url: scraped.url,
          title: scraped.title,
          emails: scraped.emails,
          phones: scraped.phones,
        });

        for (const email of scraped.emails) {
          if (!JUNK_DOMAINS.test(email) && !emails.has(email)) {
            emails.set(email, scraped.url);
          }
        }

        for (const phone of scraped.phones) {
          phones.add(phone);
        }
      } catch (error) {
        this.logger.warn(
          `Scrape failed for ${url}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Stage 3 — generate likely domain emails (contact@company.com, etc.)
    const verifiedDomain = this.inferVerifiedDomain([...emails.keys()]);
    const generated = this.buildGeneratedEmails(
      name,
      company,
      input.domain,
      uniqueUrls,
      verifiedDomain,
    );

    return {
      name,
      company,
      emails: [...emails.keys()].slice(0, 25),
      phones: [...phones].slice(0, 15),
      generated,
      sources,
      ...(queryErrors.length > 0 ? { warnings: queryErrors } : {}),
    };
  }

  private buildQueries(
    name: string,
    company: string,
    role?: string,
  ): string[] {
    const nameQuoted = `"${name}"`;
    const companyPart = company ? ` "${company}"` : '';
    const rolePart = role ? ` ${role}` : '';

    return [
      `${nameQuoted}${companyPart || rolePart} email`,
      `${nameQuoted}${companyPart} email contact`,
      name
        ? `${name} founder ${rolePart?.trim() || ''} email phone ${company}`
            .replace(/\s+/g, ' ')
            .trim()
        : company
          ? `${company} contact email phone`
          : 'contact email',
      company ? `${company} contact email team` : `${name} twitter linkedin email`,
    ];
  }

  private buildGeneratedEmails(
    name: string,
    company: string,
    domain?: string,
    urls: string[] = [],
    verifiedDomain?: string,
  ): string[] {
    // Prefer the real domain seen in verified emails (hello@zomato.com), then
    // the explicit hint, then a scraped URL host, then a company-name guess.
    let bestDomain =
      verifiedDomain ??
      domain?.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (!bestDomain && company) {
      bestDomain = company
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '')
        .replace(/\.com.*$/, '.com');

      if (!bestDomain || !/\.[a-z]{2,}$/.test(bestDomain)) {
        bestDomain = `${bestDomain}.com`;
      }
    }

    if (!bestDomain) {
      const scored = urls
        .map((url) => {
          try {
            return new URL(url).hostname;
          } catch {
            return null;
          }
        })
        .filter((host): host is string => !!host && !LISTING_HOSTS.test(host))
        .reduce<Record<string, number>>((acc, host) => {
          acc[host] = (acc[host] ?? 0) + 1;

          return acc;
        }, {});

      bestDomain = Object.entries(scored).sort((a, b) => b[1] - a[1])[0]?.[0];
    }

    if (!bestDomain) {
      return [];
    }

    const first = name.split(/\s+/)[0]?.toLowerCase() ?? '';
    const last = name.split(/\s+/).slice(-1)[0]?.toLowerCase() ?? '';
    const generated = [
      'contact@',
      'hello@',
      'info@',
      'team@',
      'hi@',
    ];

    if (first) {
      generated.push(`${first}@`);
    }

    if (first && last) {
      generated.push(`${first}.${last}@`, `${first}${last}@`);
    }

    return [...new Set(generated.map((prefix) => `${prefix}${bestDomain}`))].slice(
      0,
      12,
    );
  }

  private inferVerifiedDomain(emails: string[]): string | undefined {
    const counts = new Map<string, number>();

    for (const email of emails) {
      const host = email.split('@')[1];

      if (!host || FREE_MAIL_DOMAINS.test(host)) {
        continue;
      }

      counts.set(host, (counts.get(host) ?? 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
}