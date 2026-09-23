import {
  type LeadCandidateSource,
  type ScrapedCompany,
} from '../interfaces/lead-generation.interface';
import { getCompanyRootDomain } from './registrable-domain.util';
import { type GooglePlace } from 'src/engine/core-modules/web-search-apis/services/google-places.service';

// Job boards, news and event sites: never a company's own site and their
// outbound links are not company sites either. Directories are handled by the
// pipeline's listing expansion instead.
export const NON_COMPANY_HOSTS = [
  'businessinsider.com',
  'cnbc.com',
  'eventbrite.com',
  'forbes.com',
  'glassdoor.com',
  'indeed.com',
  'inc.com',
  'linkedin.com',
  'meetup.com',
  'monster.com',
  'naukri.com',
  'prnewswire.com',
  'reuters.com',
  'simplyhired.com',
  'techcrunch.com',
  'theverge.com',
  'ziprecruiter.com',
  '10times.com',
  'allevents.in',
  'tripadvisor.com',
];

// Never leads and never worth reading for links.
export const IGNORED_HOSTS = [
  'amazon.com',
  'apple.com',
  'bing.com',
  'blogspot.com',
  'duckduckgo.com',
  'facebook.com',
  'github.com',
  'google.com',
  'instagram.com',
  'linkedin.com',
  'medium.com',
  'pinterest.com',
  'quora.com',
  'reddit.com',
  'substack.com',
  'tiktok.com',
  'twitter.com',
  'wikipedia.org',
  'wordpress.com',
  'x.com',
  'youtube.com',
];

// Directories and publishers: not leads, but their pages link to companies.
export const DIRECTORY_HOSTS = [
  'aeroleads.com',
  'ambitionbox.com',
  'angel.co',
  'bloomberg.com',
  'builtin.com',
  'capterra.com',
  'cbinsights.com',
  'clutch.co',
  'crunchbase.com',
  'dealroom.co',
  'designrush.com',
  'f6s.com',
  'forbes.com',
  'g2.com',
  'gartner.com',
  'getapp.com',
  'getlatka.com',
  'glassdoor.com',
  'goodfirms.co',
  'indeed.com',
  'indiamart.com',
  'justdial.com',
  'naukri.com',
  'owler.com',
  'producthunt.com',
  'saasworthy.com',
  'saastartups.pro',
  'seedtable.com',
  'similarweb.com',
  'softwareadvice.com',
  'sortlist.com',
  'statista.com',
  'techcrunch.com',
  'tofler.in',
  'tracxn.com',
  'trustpilot.com',
  'upwork.com',
  'vcbacked.co',
  'wellfound.com',
  'yellowpages.com',
  'yelp.com',
  'ycombinator.com',
  'zaubacorp.com',
  'zoominfo.com',
];

export const LISTICLE_TITLE = /^(top|best)\s+\d+|\d+\s+(best|top)\b/i;

const NON_COMPANY_TITLE =
  /\b(jobs?|careers? at|hiring|vacanc(y|ies)|conference|summit|expo|webinar|press release|news)\b/i;

const NON_COMPANY_HOST_LABEL = /(^|\.)(jobs?|careers|news|events?)\./i;

// Appended to web search queries. Engines without operator support just see a
// few extra words, which is harmless.
export const WEB_SEARCH_QUERY_EXCLUSIONS = '-"top 10" -"best companies" -jobs';

export const normalizeHostname = (value?: string): string | undefined => {
  const raw = value?.trim().toLowerCase();

  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`,
    );

    return url.hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
};

// Company records and dedupe keys use the registrable root: "https://data.cledara.com" -> "cledara.com".
export const normalizeDomain = (value?: string): string | undefined => {
  const hostname = normalizeHostname(value);

  return hostname ? getCompanyRootDomain(hostname) || undefined : undefined;
};

const matchesHost = (domain: string, hosts: string[]) =>
  hosts.some((host) => domain === host || domain.endsWith(`.${host}`));

export const isLikelyNonCompanyResult = (result: {
  url: string;
  title?: string;
}): boolean => {
  const domain = normalizeHostname(result.url);

  if (!domain) {
    return true;
  }

  if (matchesHost(domain, NON_COMPANY_HOSTS)) {
    return true;
  }

  if (NON_COMPANY_HOST_LABEL.test(`${domain}.`)) {
    return true;
  }

  const title = result.title?.trim() ?? '';

  return LISTICLE_TITLE.test(title) || NON_COMPANY_TITLE.test(title);
};

// Directories, events, communities, job boards and media are not companies.
// Unambiguous words match anywhere; words that also appear in real business
// names ("Community Dental Care") only match as the last word.
const NON_COMPANY_NAME =
  /\b(conference|summit|expo|hackathon|meetups?|festival|webinar|job board|jobs?|careers|startup map|directory|press release|podcast|magazine)\b|\b(week|community|communities|awards?|news)$/i;

export const isNonCompanyLead = (lead: {
  name?: string;
  domain?: string;
  url?: string;
  source?: LeadCandidateSource;
}): boolean => {
  const hostname =
    normalizeHostname(lead.url) ?? normalizeHostname(lead.domain);
  const name = lead.name?.trim() ?? '';

  if (hostname) {
    const root = normalizeDomain(hostname) ?? hostname;

    if (
      matchesHost(root, [
        ...NON_COMPANY_HOSTS,
        ...IGNORED_HOSTS,
        ...DIRECTORY_HOSTS,
      ]) ||
      NON_COMPANY_HOST_LABEL.test(`${hostname}.`)
    ) {
      return true;
    }
  }

  // Places results are real businesses; only their host is checked.
  if (lead.source === 'google_places') {
    return false;
  }

  const hostWords = hostname?.replace(/[.-]+/g, ' ') ?? '';

  return [name, hostWords].some(
    (text) =>
      !!text &&
      (LISTICLE_TITLE.test(text) ||
        NON_COMPANY_TITLE.test(text) ||
        NON_COMPANY_NAME.test(text)),
  );
};

// Keeps the first company per normalized domain, so earlier sources win.
// Companies without a website are deduped by name + location instead.
export const dedupeCompaniesByDomain = (
  companies: ScrapedCompany[],
  excludeDomains: Iterable<string> = [],
): ScrapedCompany[] => {
  const seen = new Set<string>(
    [...excludeDomains].map((domain) => normalizeDomain(domain) ?? domain),
  );

  return companies.filter((company) => {
    const key =
      normalizeDomain(company.domain ?? company.url) ??
      `name:${company.name.trim().toLowerCase()}|${company.location.trim().toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
};

const GENERIC_PLACE_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'store',
  'food',
  'health',
  'finance',
  'premise',
  'service',
]);

const humanizePlaceType = (type: string) =>
  type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');

export const placeToCompany = (place: GooglePlace): ScrapedCompany => {
  const website = place.websiteUri?.trim();
  const domain = normalizeDomain(website);
  const specificType = place.types?.find(
    (type) => !GENERIC_PLACE_TYPES.has(type),
  );
  const source: LeadCandidateSource = 'google_places';

  return {
    name: place.displayName?.text?.trim() || domain || 'Unknown business',
    domain,
    url: domain && website ? website : '',
    description: '',
    industry: specificType ? humanizePlaceType(specificType) : '',
    size: '',
    location: place.formattedAddress ?? '',
    emails: [],
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? '',
    socialLinks: [],
    employees: '',
    founded: '',
    source,
    externalId: place.id,
    rating: place.rating,
    reviewCount: place.userRatingCount,
  };
};

// Places data is authoritative for name, phone and address; the scraped site
// adds description and emails.
export const mergePlaceWithScrapedSite = (
  place: ScrapedCompany,
  scraped: ScrapedCompany | null,
): ScrapedCompany =>
  scraped
    ? {
        ...scraped,
        name: place.name,
        domain: place.domain ?? scraped.domain,
        industry: place.industry || scraped.industry,
        location: place.location || scraped.location,
        phone: place.phone || scraped.phone,
        source: place.source,
        externalId: place.externalId,
        rating: place.rating,
        reviewCount: place.reviewCount,
      }
    : place;
