import { Injectable, Logger } from '@nestjs/common';

import {
  type IdealCustomerProfile,
  type Lead,
  type LeadSearchResult,
  type ScrapedCompany,
} from '../interfaces/lead-generation.interface';
import { WebSearchService } from './web-search.service';
import { CompanyScraperService } from './company-scraper.service';
import { AiLeadScoringService } from './ai-lead-scoring.service';
import { LeadPersistenceService } from './lead-persistence.service';
import {
  getCompanyHomepageHost,
  getRegistrableDomain,
} from '../utils/registrable-domain.util';
import {
  dedupeCompaniesByDomain,
  DIRECTORY_HOSTS,
  IGNORED_HOSTS,
  isLikelyNonCompanyResult,
  isNonCompanyLead,
  LISTICLE_TITLE,
  NON_COMPANY_HOSTS,
  mergePlaceWithScrapedSite,
  placeToCompany,
} from '../utils/lead-candidate.util';
import {
  type GooglePlace,
  GooglePlacesService,
} from 'src/engine/core-modules/web-search-apis/services/google-places.service';

const MAX_LEADS = 25;
const MAX_CANDIDATES = 20;
const MAX_LISTING_PAGES = 4;
const FETCH_CONCURRENCY = 6;
const MIN_AI_SCORE = 20;

const ARTICLE_PATH =
  /\/(blog|news|articles?|insights|guides?|lists?|reviews?|compare|top-\d+[^/]*|best-[^/]*)(\/|$)/i;

const matchesHost = (domain: string, hosts: string[]) =>
  hosts.some((host) => domain === host || domain.endsWith(`.${host}`));

// Splits search hits into company homepages and listing pages (directories,
// listicles, articles) whose outbound links are expanded one hop. Job boards,
// news and event sites are dropped before anything is scraped.
export const classifyResultUrls = (
  results: { url: string; title?: string }[],
) => {
  const homepages: string[] = [];
  const listingPages: string[] = [];
  let filtered = 0;

  for (const { url: rawUrl, title } of results) {
    let url: URL;

    try {
      url = new URL(rawUrl);
    } catch {
      continue;
    }

    const domain = getRegistrableDomain(url.hostname);

    if (matchesHost(domain, IGNORED_HOSTS)) {
      continue;
    }

    if (matchesHost(domain, NON_COMPANY_HOSTS)) {
      filtered += 1;
      continue;
    }

    if (matchesHost(domain, DIRECTORY_HOSTS)) {
      listingPages.push(url.toString());
      continue;
    }

    const isListicle = LISTICLE_TITLE.test(title?.trim() ?? '');

    if (isListicle || ARTICLE_PATH.test(url.pathname)) {
      listingPages.push(url.toString());
    }

    if (
      isListicle ||
      isLikelyNonCompanyResult({ url: url.toString(), title })
    ) {
      filtered += 1;
      continue;
    }

    homepages.push(`${url.protocol}//${getCompanyHomepageHost(url.hostname)}/`);
  }

  return { homepages, listingPages, filtered };
};

const dedupeByDomain = (urls: string[]): string[] => {
  const seen = new Set<string>();

  return urls.filter((url) => {
    const domain = getRegistrableDomain(new URL(url).hostname);

    if (seen.has(domain)) {
      return false;
    }

    seen.add(domain);

    return true;
  });
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;

        results[index] = await worker(items[index]);
      }
    }),
  );

  return results;
};

@Injectable()
export class LeadGenerationService {
  private readonly logger = new Logger(LeadGenerationService.name);

  constructor(
    private readonly webSearch: WebSearchService,
    private readonly scraper: CompanyScraperService,
    private readonly aiScoring: AiLeadScoringService,
    private readonly persistence: LeadPersistenceService,
    private readonly googlePlaces: GooglePlacesService,
  ) {}

  async findLeads(icp: IdealCustomerProfile): Promise<LeadSearchResult> {
    const startedAt = Date.now();
    const requested = Number(icp.maxResults);
    const count =
      Number.isFinite(requested) && requested >= 1
        ? Math.min(Math.round(requested), MAX_LEADS)
        : 10;
    const hints: string[] = [];

    const placesCompanies = await this.findPlacesCompanies(icp, count, hints);
    const remaining = count - placesCompanies.length;
    const queries = remaining > 0 ? this.webSearch.buildSearchQueries(icp) : [];
    const web =
      remaining > 0
        ? await this.findWebCompanies(
            queries,
            remaining,
            placesCompanies
              .map((company) => company.domain)
              .filter((domain): domain is string => !!domain),
          )
        : undefined;

    const companies = dedupeCompaniesByDomain([
      ...placesCompanies,
      ...(web?.companies ?? []),
    ]).filter((company) => !isNonCompanyLead(company));

    const { leads, aiScored } = await this.aiScoring.scoreBatch(companies, icp);
    const topLeads = leads
      .filter((lead) => !aiScored || lead.score >= MIN_AI_SCORE)
      .slice(0, count);

    try {
      await this.persistence.save(topLeads);
    } catch (error) {
      this.logger.warn(`Could not save lead history: ${error}`);
    }

    if (web?.blocked) {
      hints.push(
        'DuckDuckGo rate-limited this search. Wait a minute, or add a search API key in Settings → Web Search APIs.',
      );
    } else if (web && web.source !== 'search-api') {
      hints.push(
        'Add a Firecrawl, Tavily, Brave or SerpAPI key in Settings → Web Search APIs for much better results.',
      );
    }
    if (!aiScored) {
      hints.push(
        'Add an AI provider key in Settings → AI Providers (or run Ollama) to rank leads by fit.',
      );
    }

    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `Lead search: ${placesCompanies.length} places, ${web?.results ?? 0} web results (${web?.filtered ?? 0} filtered, ${web?.listingPages ?? 0} listing pages), ${web?.candidates ?? 0} web candidates, ${companies.length} companies, ${topLeads.length} leads in ${durationMs}ms`,
    );

    return {
      leads: topLeads,
      searchQuery: [
        ...(placesCompanies.length > 0
          ? [this.webSearch.buildPlacesQuery(icp)]
          : []),
        ...queries,
      ].join(' | '),
      stats: {
        searchSource: web?.source ?? 'none',
        searchBlocked: web?.blocked ?? false,
        searchResults: web?.results ?? 0,
        placesResults: placesCompanies.length,
        candidates: placesCompanies.length + (web?.candidates ?? 0),
        fetched: companies.length,
        aiScored,
        durationMs,
      },
      hints,
    };
  }

  // Google Places first when the workspace has a key. Sites of places that
  // have one are scraped for description and emails; places without a website
  // are kept as they are.
  private async findPlacesCompanies(
    icp: IdealCustomerProfile,
    count: number,
    hints: string[],
  ): Promise<ScrapedCompany[]> {
    let places: GooglePlace[] | null;

    try {
      places = await this.googlePlaces.searchWithWorkspaceKey(
        this.webSearch.buildPlacesQuery(icp),
        count,
      );
    } catch (error) {
      this.logger.warn(`Google Places search failed: ${error}`);
      hints.push(
        'Google Places search failed. Check the key in Settings → Web Search APIs.',
      );

      return [];
    }

    if (!places) {
      return [];
    }

    const placeCompanies = dedupeCompaniesByDomain(places.map(placeToCompany));

    return mapWithConcurrency(
      placeCompanies,
      FETCH_CONCURRENCY,
      async (place) =>
        place.url
          ? mergePlaceWithScrapedSite(
              place,
              await this.scraper.scrapeCompany(place.url).catch(() => null),
            )
          : place,
    );
  }

  private async findWebCompanies(
    queries: string[],
    remaining: number,
    excludeDomains: string[],
  ) {
    const candidateLimit = Math.min(remaining * 2, MAX_CANDIDATES);
    const { results, source, blocked } = await this.webSearch.searchMany(
      queries,
      candidateLimit,
    );
    const { homepages, listingPages, filtered } = classifyResultUrls(results);
    const excluded = new Set(excludeDomains.map(getRegistrableDomain));
    const withoutExcluded = (urls: string[]) =>
      dedupeByDomain(urls).filter(
        (url) => !excluded.has(getRegistrableDomain(new URL(url).hostname)),
      );
    let candidates = withoutExcluded(homepages);

    if (candidates.length < candidateLimit && listingPages.length > 0) {
      const outboundLinks = await mapWithConcurrency(
        listingPages.slice(0, MAX_LISTING_PAGES),
        FETCH_CONCURRENCY,
        (url) => this.scraper.fetchOutboundLinks(url),
      );

      candidates = withoutExcluded([
        ...candidates,
        ...classifyResultUrls(outboundLinks.flat().map((url) => ({ url })))
          .homepages,
      ]);
    }

    candidates = candidates.slice(0, candidateLimit);

    const companies = (
      await mapWithConcurrency(candidates, FETCH_CONCURRENCY, (url) =>
        this.scraper.scrapeCompany(url),
      )
    )
      .filter((company): company is ScrapedCompany => !!company?.name)
      .map((company) => ({ ...company, source: 'web_search' as const }));

    return {
      companies,
      source,
      blocked,
      results: results.length,
      filtered,
      listingPages: listingPages.length,
      candidates: candidates.length,
    };
  }

  async generateOutreach(
    lead: Lead,
    icp: IdealCustomerProfile,
    model?: string,
  ): Promise<string> {
    return this.aiScoring.generateOutreach(lead, icp, model);
  }

  async getSavedLeads(): Promise<Lead[]> {
    return this.persistence.list();
  }

  async generateBulkOutreach(
    leads: Lead[],
    icp: IdealCustomerProfile,
    model?: string,
  ): Promise<{ leadId: string; message: string }[]> {
    const results: { leadId: string; message: string }[] = [];

    for (const lead of leads) {
      const message = await this.generateOutreach(lead, icp, model);
      results.push({ leadId: lead.id, message });
    }

    return results;
  }
}
