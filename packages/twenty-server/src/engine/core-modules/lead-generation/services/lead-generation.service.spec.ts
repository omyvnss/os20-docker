import { type ScrapedCompany } from 'src/engine/core-modules/lead-generation/interfaces/lead-generation.interface';
import { AiLeadScoringService } from 'src/engine/core-modules/lead-generation/services/ai-lead-scoring.service';
import { type CompanyScraperService } from 'src/engine/core-modules/lead-generation/services/company-scraper.service';
import { type LeadByokService } from 'src/engine/core-modules/lead-generation/services/lead-byok.service';
import {
  classifyResultUrls,
  LeadGenerationService,
} from 'src/engine/core-modules/lead-generation/services/lead-generation.service';
import { type LeadPersistenceService } from 'src/engine/core-modules/lead-generation/services/lead-persistence.service';
import { WebSearchService } from 'src/engine/core-modules/lead-generation/services/web-search.service';
import {
  dedupeCompaniesByDomain,
  isLikelyNonCompanyResult,
  normalizeDomain,
  placeToCompany,
} from 'src/engine/core-modules/lead-generation/utils/lead-candidate.util';
import { type ProviderRegistry } from 'src/engine/core-modules/ai-provider/registry/provider.registry';
import {
  GOOGLE_PLACES_FIELD_MASK,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  type GooglePlace,
  GooglePlacesService,
} from 'src/engine/core-modules/web-search-apis/services/google-places.service';
import {
  type WebSearchResult,
  WebSearchToolService,
} from 'src/engine/core-modules/web-search-apis/services/web-search-tool.service';
import { type WebSearchApiService } from 'src/engine/core-modules/web-search-apis/web-search-api.service';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const place = (overrides: Partial<GooglePlace>): GooglePlace => ({
  id: 'place-1',
  displayName: { text: 'Acme Dental', languageCode: 'en' },
  websiteUri: 'https://www.Acme-Dental.com/',
  nationalPhoneNumber: '030 1234567',
  internationalPhoneNumber: '+49 30 1234567',
  formattedAddress: 'Hauptstr. 1, 10115 Berlin, Germany',
  types: ['dentist', 'health', 'point_of_interest', 'establishment'],
  rating: 4.7,
  userRatingCount: 212,
  ...overrides,
});

const webResult = (url: string, title: string): WebSearchResult => ({
  url,
  title,
  snippet: '',
  domain: new URL(url).hostname,
});

const scraped = (url: string): ScrapedCompany => ({
  name: `Site ${new URL(url).hostname}`,
  domain: new URL(url).hostname.replace(/^www\./, ''),
  url,
  description: 'We build things',
  industry: '',
  size: '',
  location: '',
  emails: [`hello@${new URL(url).hostname.replace(/^www\./, '')}`],
  phone: '',
  socialLinks: [],
  employees: '',
  founded: '',
});

describe('Google Places lead source', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends a Text Search (New) request with the key and field mask headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ places: [place({})] }));

    const service = new GooglePlacesService({} as WebSearchApiService);
    const places = await service.searchText('KEY', 'dentists in Berlin', 5);

    expect(places).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(url).toBe(GOOGLE_PLACES_TEXT_SEARCH_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('KEY');
    expect(init.headers['X-Goog-FieldMask']).toBe(GOOGLE_PLACES_FIELD_MASK);
    expect(GOOGLE_PLACES_FIELD_MASK).not.toContain(' ');
    expect(GOOGLE_PLACES_FIELD_MASK.split(',')).toEqual([
      'places.id',
      'places.displayName',
      'places.websiteUri',
      'places.nationalPhoneNumber',
      'places.internationalPhoneNumber',
      'places.formattedAddress',
      'places.types',
      'places.rating',
      'places.userRatingCount',
      'nextPageToken',
    ]);
    expect(JSON.parse(init.body)).toEqual({
      textQuery: 'dentists in Berlin',
      pageSize: 5,
    });
  });

  it('pages with nextPageToken, caps pageSize at 20 and stops at the limit', async () => {
    const page = (prefix: string, size: number) =>
      Array.from({ length: size }, (_, i) => place({ id: `${prefix}${i}` }));

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ places: page('a', 20), nextPageToken: 'next-1' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ places: page('b', 20), nextPageToken: 'next-2' }),
      );

    const service = new GooglePlacesService({} as WebSearchApiService);
    const places = await service.searchText('KEY', 'cafes', 25);

    expect(places).toHaveLength(25);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      textQuery: 'cafes',
      pageSize: 20,
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      textQuery: 'cafes',
      pageSize: 20,
      pageToken: 'next-1',
    });
  });

  it('throws a status error the settings test endpoint can describe', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 403));

    const service = new GooglePlacesService({} as WebSearchApiService);

    await expect(service.searchText('BAD', 'cafes', 1)).rejects.toThrow(
      'Places search failed: 403',
    );
  });

  it('maps a place into the scraped company shape', () => {
    expect(placeToCompany(place({}))).toEqual({
      name: 'Acme Dental',
      domain: 'acme-dental.com',
      url: 'https://www.Acme-Dental.com/',
      description: '',
      industry: 'Dentist',
      size: '',
      location: 'Hauptstr. 1, 10115 Berlin, Germany',
      emails: [],
      phone: '+49 30 1234567',
      socialLinks: [],
      employees: '',
      founded: '',
      source: 'google_places',
      externalId: 'place-1',
      rating: 4.7,
      reviewCount: 212,
    });

    const withoutWebsite = placeToCompany(
      place({ websiteUri: undefined, internationalPhoneNumber: undefined }),
    );

    expect(withoutWebsite.url).toBe('');
    expect(withoutWebsite.domain).toBeUndefined();
    expect(withoutWebsite.phone).toBe('030 1234567');
  });

  it('never uses a google_places key as a web search key', async () => {
    const tool = new WebSearchToolService({
      listWithSecrets: async () => [
        {
          id: '1',
          provider: 'google_places',
          apiKey: 'PLACES',
          createdAt: new Date(),
        },
      ],
    } as unknown as WebSearchApiService);

    await expect(tool.search('dentists', 5)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('web search result filter', () => {
  it.each([
    ['https://someblog.com/post', 'Top 10 SaaS companies in Berlin'],
    ['https://someblog.com/post', 'Best 25 dental clinics'],
    ['https://someblog.com/post', 'The 15 best CRM tools for 2026'],
    ['https://www.indeed.com/q-sales', 'Sales jobs in Berlin'],
    ['https://jobs.acme.com/', 'Acme'],
    ['https://www.eventbrite.com/e/saas-meetup', 'SaaS meetup'],
    ['https://acme.com/', 'Acme careers at Acme'],
    ['https://www.reuters.com/tech', 'Reuters tech'],
  ])('flags %s "%s"', (url, title) => {
    expect(isLikelyNonCompanyResult({ url, title })).toBe(true);
  });

  it.each([
    ['https://www.acme-dental.com/', 'Acme Dental | Family dentist in Berlin'],
    ['https://stripe.com/', 'Stripe | Financial Infrastructure'],
    ['https://top10.example/', 'Top Notch Plumbing'],
  ])('keeps %s "%s"', (url, title) => {
    expect(isLikelyNonCompanyResult({ url, title })).toBe(false);
  });

  it('sends listicles to listing expansion instead of scraping them as companies', () => {
    const { homepages, listingPages, filtered } = classifyResultUrls([
      { url: 'https://acme.com/', title: 'Acme' },
      { url: 'https://listy.io/saas', title: 'Top 10 SaaS startups' },
      { url: 'https://www.indeed.com/jobs', title: 'Jobs' },
      { url: 'https://www.clutch.co/agencies', title: 'Agencies' },
    ]);

    expect(homepages).toEqual(['https://acme.com/']);
    expect(listingPages).toEqual([
      'https://listy.io/saas',
      'https://www.clutch.co/agencies',
    ]);
    expect(filtered).toBe(2);
  });
});

describe('domain dedupe', () => {
  it('normalizes case, protocol, www and paths', () => {
    expect(normalizeDomain('https://WWW.Acme.com/about?x=1')).toBe('acme.com');
    expect(normalizeDomain('Acme.com')).toBe('acme.com');
    expect(normalizeDomain('')).toBeUndefined();
  });

  it('keeps the first company per domain across sources', () => {
    const fromPlaces = placeToCompany(
      place({ websiteUri: 'https://www.acme.com/' }),
    );
    const fromWeb = {
      ...scraped('https://ACME.com/'),
      source: 'web_search' as const,
    };
    const other = {
      ...scraped('https://beta.io/'),
      source: 'web_search' as const,
    };
    const noSite1 = placeToCompany(
      place({ id: 'p2', websiteUri: undefined, displayName: { text: 'Bob' } }),
    );
    const noSite2 = placeToCompany(
      place({ id: 'p3', websiteUri: undefined, displayName: { text: 'bob' } }),
    );

    const result = dedupeCompaniesByDomain([
      fromPlaces,
      fromWeb as ScrapedCompany,
      other as ScrapedCompany,
      noSite1,
      noSite2,
    ]);

    expect(result.map((company) => company.source)).toEqual([
      'google_places',
      'web_search',
      'google_places',
    ]);
    expect(result[0].name).toBe('Acme Dental');
  });

  it('drops companies whose domain is excluded', () => {
    expect(
      dedupeCompaniesByDomain([scraped('https://acme.com/')], ['www.acme.com']),
    ).toEqual([]);
  });
});

describe('LeadGenerationService source ordering', () => {
  const fetchMock = jest.fn();
  let webSearchTool: { search: jest.Mock };
  let getApiKey: jest.Mock;
  let scraper: {
    scrapeCompany: jest.Mock;
    fetchOutboundLinks: jest.Mock;
  };
  let service: LeadGenerationService;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    webSearchTool = { search: jest.fn() };
    getApiKey = jest.fn();
    scraper = {
      scrapeCompany: jest.fn(async (url: string) => scraped(url)),
      fetchOutboundLinks: jest.fn(async () => []),
    };

    service = new LeadGenerationService(
      new WebSearchService(webSearchTool as unknown as WebSearchToolService),
      scraper as unknown as CompanyScraperService,
      new AiLeadScoringService(
        {} as ProviderRegistry,
        { resolve: async () => null } as unknown as LeadByokService,
      ),
      { save: jest.fn() } as unknown as LeadPersistenceService,
      new GooglePlacesService({ getApiKey } as unknown as WebSearchApiService),
    );
  });

  it('uses Places first and fills the rest from web search, deduped by domain', async () => {
    getApiKey.mockResolvedValue('PLACES_KEY');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        places: [
          place({ id: 'p1', websiteUri: 'https://www.acme.com/' }),
          place({
            id: 'p2',
            displayName: { text: 'No Site Dental' },
            websiteUri: undefined,
          }),
        ],
      }),
    );
    webSearchTool.search.mockResolvedValue([
      webResult('https://acme.com/', 'Acme'),
      webResult('https://beta-dental.com/', 'Beta Dental'),
      webResult('https://blog.example.com/x', 'Top 10 dentists in Berlin'),
      webResult('https://www.indeed.com/dentist', 'Dentist jobs'),
    ]);

    const result = await service.findLeads({
      keywords: ['dentists'],
      location: 'Berlin',
      maxResults: 3,
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      textQuery: 'dentists in Berlin',
      pageSize: 3,
    });
    // One lead left to fill, so web search asks for 2 candidates per query.
    expect(webSearchTool.search).toHaveBeenCalledWith(
      expect.stringContaining('-"top 10"'),
      2,
    );
    expect(scraper.scrapeCompany).not.toHaveBeenCalledWith(
      'https://www.indeed.com/',
    );

    const bySource = result.leads.map((lead) => [lead.domain, lead.source]);

    expect(bySource).toEqual(
      expect.arrayContaining([
        ['acme.com', 'google_places'],
        [undefined, 'google_places'],
        ['beta-dental.com', 'web_search'],
      ]),
    );
    expect(result.leads).toHaveLength(3);
    expect(result.stats.placesResults).toBe(2);

    const noSite = result.leads.find((lead) => !lead.companyUrl);
    const acme = result.leads.find((lead) => lead.domain === 'acme.com');

    expect(noSite?.phone).toBe('+49301234567');
    expect(noSite?.score).toBeLessThan(acme?.score ?? 0);
    expect(acme?.company).toBe('Acme Dental');
    expect(acme?.externalId).toBe('p1');
  });

  it('skips web search when Places fills the requested count', async () => {
    getApiKey.mockResolvedValue('PLACES_KEY');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        places: [
          place({ id: 'p1', websiteUri: 'https://one.com/' }),
          place({ id: 'p2', websiteUri: 'https://two.com/' }),
        ],
      }),
    );

    const result = await service.findLeads({
      keywords: ['dentists'],
      maxResults: 2,
    });

    expect(webSearchTool.search).not.toHaveBeenCalled();
    expect(result.leads.every((lead) => lead.source === 'google_places')).toBe(
      true,
    );
  });

  it('uses only web search when there is no Places key', async () => {
    getApiKey.mockResolvedValue(undefined);
    webSearchTool.search.mockResolvedValue([
      webResult('https://beta-dental.com/', 'Beta Dental'),
    ]);

    const result = await service.findLeads({
      keywords: ['dentists'],
      maxResults: 2,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.leads.map((lead) => lead.source)).toEqual(['web_search']);
    expect(result.stats.placesResults).toBe(0);
  });
});
