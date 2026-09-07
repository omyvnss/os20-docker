import { Injectable, Logger } from '@nestjs/common';

import { v4 } from 'uuid';

import {
  type LeadSource,
  type LeadSourceCriteria,
  type LeadSourceSearchResult,
  type SourceLeadCandidate,
} from '../interfaces/lead-source.interface';

import {
  type WebAgentDto,
  WebAgentService,
} from 'src/engine/core-modules/web-agent/web-agent.service';

const DEFAULT_MAX_RESULTS = 20;
const MAX_RESULTS_CAP = 50;
const FETCH_TIMEOUT_MS = 15000;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const OSM_AMENITIES: string[] = [
  'bar', 'bbq', 'biergarten', 'cafe', 'drinking_water', 'fast_food',
  'food_court', 'ice_cream', 'pub', 'restaurant', 'bank', 'bureau_de_change',
  'atm', 'tax_advisor', 'gym', 'healthcare', 'doctor', 'dentist', 'clinic',
  'hospital', 'pharmacy', 'veterinary', 'transport', 'bus_station', 'taxi',
  'fuel', 'parking', 'car_sharing', 'charging_station', 'car_rental',
  'car_repair', 'car_wash', 'vehicle_inspection', 'bicycle_rental',
  'bicycle_repair_station', 'motorcycle_parking', 'tourist_agency', 'travel_agency',
  'hotel', 'motel', 'guest_house', 'hostel', 'apartment', 'chalet', 'shelter',
  'camp_site', 'caravan_site', 'arts_centre', 'cinema', 'fountain', 'nightclub',
  'planetarium', 'social_centre', 'stage', 'stripclub', 'studio', 'swingerclub',
  'theatre', 'music_venue', 'malaria_care', 'police', 'post_office', 'prison',
  'ranger_station', 'fire_station', 'townhall', 'courthouse', 'marketplace',
  'community_centre', 'events_venue', 'exhibition_centre', 'kingdom_hall',
  'library', 'music_school', 'place_of_worship', 'student_club', 'university',
  'school', 'college', 'kindergarten', 'language_school', 'driving_school',
  'nursing_home', 'ambulance_station', 'social_facility', 'grave_yard',
  'bench', 'clock', 'conference_centre', 'dive_centre', 'funeral_hall',
  'internet_cafe', 'kitchen', 'monastery', 'parcel_locker', 'photo_booth',
  'recycling', 'sauna', 'spa', 'vending_machine', 'waste_basket', 'wifi',
  'animal_boarding', 'animal_shelter', 'beauty_salon', 'changing_table',
  'childcare', 'crematorium', 'internet_cafe_shop', 'pawnbroker', 'public_bookcase',
  'shower', 'toilets', 'workstation', 'fitness_centre', 'yoga', 'park', 'garden',
  'dog_park', 'marina', 'sports_centre', 'swimming_pool', 'tennis', 'stadium',
  'pitch', 'ice_rink', 'sports_hall', 'dressmaker', 'copyshop', 'mobile_disconnect',
  'electronics_repair', 'tailor', 'photo_laboratory', 'retirement_home',
  'animal_rescue', 'quartermaster', 'publishing', 'radio_studio', 'recording_studio',
  'photography', 'video', '3d_printing', 'design', 'architecture_studio',
  'consulting', 'marketing_agency', 'web_agency', 'software_company',
  'it_service', 'co_working', 'incubator', 'startup', 'data_center', 'server_room',
];

const RATING_COUNTRIES: { value: string; label: string }[] = [
  { value: '', label: 'Any country' },
  { value: 'India', label: 'India' },
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Germany', label: 'Germany' },
  { value: 'France', label: 'France' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Japan', label: 'Japan' },
  { value: 'South Korea', label: 'South Korea' },
];

const GITHUB_LANGUAGES: { value: string; label: string }[] = [
  { value: '', label: 'Any language' },
  { value: 'TypeScript', label: 'TypeScript' },
  { value: 'JavaScript', label: 'JavaScript' },
  { value: 'Python', label: 'Python' },
  { value: 'Go', label: 'Go' },
  { value: 'Rust', label: 'Rust' },
  { value: 'Swift', label: 'Swift' },
  { value: 'Kotlin', label: 'Kotlin' },
  { value: 'Java', label: 'Java' },
  { value: 'C++', label: 'C++' },
  { value: 'PHP', label: 'PHP' },
  { value: 'Ruby', label: 'Ruby' },
];

@Injectable()
export class LeadSourcesService {
  private readonly logger = new Logger(LeadSourcesService.name);

  constructor(private readonly webAgentService: WebAgentService) {}

  async getCatalog(): Promise<LeadSource[]> {
    const agents = await this.webAgentService.list();

    return [
      ...this.agentsSource(agents),
      {
        id: 'google-maps',
        name: 'Google Maps',
        description:
          'Local businesses and places matched against your keyword and location, including ratings, websites and phones.',
        category: 'Business directories',
        access: 'SCRAPE',
        note: 'Server-side scraping; Google may occasionally throttle it.',
        criteriaFields: [
          { key: 'keyword', label: 'What are you looking for?', type: 'text', placeholder: 'e.g. plumber, spa, saas agency', defaultValue: 'plumber' },
          { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Delhi, London, Austin', defaultValue: 'Paris' },
          { key: 'searchMode', label: 'Match mode', type: 'select', defaultValue: 'any',
            options: [
              { value: 'any', label: 'Any of the words' },
              { value: 'exact', label: 'Exact phrase' },
            ] },
          { key: 'minRating', label: 'Minimum rating (0 = any)', type: 'number', defaultValue: 0 },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'overpass',
        name: 'OpenStreetMap (Overpass API)',
        description:
          'Every shop, restaurant, clinic, agency and more in a city, filtered by 100+ business categories (OSM amenity tags).',
        category: 'Business directories',
        access: 'FREE',
        criteriaFields: [
          { key: 'amenity', label: 'Business category', type: 'select', defaultValue: 'cafe',
            options: OSM_AMENITIES.map((a) => ({ value: a, label: a.replace(/_/g, ' ') })) },
          { key: 'location', label: 'City / area', type: 'text', placeholder: 'e.g. Mumbai', defaultValue: 'Mumbai' },
          { key: 'country', label: 'Country', type: 'select', options: RATING_COUNTRIES },
          { key: 'keyword', label: 'Name contains (optional)', type: 'text', placeholder: 'e.g. tech' },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 15 },
        ],
      },
      {
        id: 'nominatim',
        name: 'OpenStreetMap Places (Nominatim)',
        description:
          'Geocoded places from OSM: venues, addresses and named businesses for any keyword + city.',
        category: 'Business directories',
        access: 'FREE',
        criteriaFields: [
          { key: 'keyword', label: 'Keyword', type: 'text', placeholder: 'e.g. coffee, gym, coworking', defaultValue: 'coworking' },
          { key: 'location', label: 'City', type: 'text', placeholder: 'e.g. Bangalore', defaultValue: 'Bangalore' },
          { key: 'country', label: 'Country', type: 'select', options: RATING_COUNTRIES },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 15 },
        ],
      },
      {
        id: 'bing',
        name: 'Bing Web Search',
        description:
          'Web results for your keyword + location — perfect to surface companies that mention what you look for.',
        category: 'Web & local search',
        access: 'SCRAPE',
        note: 'Server-side scraping of the public search page.',
        criteriaFields: [
          { key: 'keyword', label: 'Keyword', type: 'text', placeholder: 'e.g. AI automation agency', defaultValue: 'AI automation agency' },
          { key: 'location', label: 'Location (optional)', type: 'text', placeholder: 'e.g. London' },
          { key: 'siteFilter', label: 'Restrict to a domain', type: 'text', placeholder: 'e.g. linkedin.com' },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'duckduckgo',
        name: 'DuckDuckGo Web Search',
        description:
          'Privacy-first web search results for any keyword — companies, directories, job postings.',
        category: 'Web & local search',
        access: 'FREE',
        criteriaFields: [
          { key: 'keyword', label: 'Keyword', type: 'text', placeholder: 'e.g. real estate startup', defaultValue: 'real estate startup' },
          { key: 'location', label: 'Location (optional)', type: 'text', placeholder: 'e.g. Gurgaon' },
          { key: 'fileType', label: 'File type (optional)', type: 'select', defaultValue: '',
            options: [
              { value: '', label: 'Any' },
              { value: 'pdf', label: 'PDF' },
              { value: 'csv', label: 'CSV' },
            ] },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'github',
        name: 'GitHub Repositories',
        description:
          'Open-source repositories by language, stars and topic — great for finding product/tech leads and startup signals.',
        category: 'Developer & startup communities',
        access: 'FREE_LIMITED',
        note: 'Unauthenticated GitHub API (~10 req/min).',
        criteriaFields: [
          { key: 'keyword', label: 'Search topic / keyword', type: 'text', placeholder: 'e.g. saas, analytics', defaultValue: 'saas' },
          { key: 'language', label: 'Language', type: 'select', options: GITHUB_LANGUAGES },
          { key: 'minStars', label: 'Min stars', type: 'number', defaultValue: 10 },
          { key: 'sort', label: 'Sort by', type: 'select', defaultValue: 'stars',
            options: [
              { value: 'stars', label: 'Most stars' },
              { value: 'updated', label: 'Recently updated' },
            ] },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'hn-algolia',
        name: 'Hacker News (Algolia)',
        description:
          'Stories and mentions on Hacker News — find products, launches and companies people talk about.',
        category: 'Developer & startup communities',
        access: 'FREE',
        criteriaFields: [
          { key: 'keyword', label: 'Keyword', type: 'text', placeholder: 'e.g. YC company', defaultValue: 'YC company' },
          { key: 'storyType', label: 'Type', type: 'select', defaultValue: 'story',
            options: [
              { value: 'story', label: 'Stories' },
              { value: 'ask_hn', label: 'Ask HN' },
              { value: 'show_hn', label: 'Show HN' },
            ] },
          { key: 'minPoints', label: 'Min points', type: 'number', defaultValue: 0 },
          { key: 'timeRange', label: 'Time range', type: 'select', defaultValue: 'all',
            options: [
              { value: 'all', label: 'All time' },
              { value: 'month', label: 'Last month' },
              { value: 'week', label: 'Last week' },
            ] },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'reddit',
        name: 'Reddit',
        description:
          'Posts mentioning your keyword across subreddits — real-world demand signals and brand mentions.',
        category: 'Developer & startup communities',
        access: 'SCRAPE',
        note: 'Reddit can rate-limit scripted requests; retry gives best results.',
        criteriaFields: [
          { key: 'keyword', label: 'Keyword', type: 'text', placeholder: 'e.g. "looking for a crm"', defaultValue: 'looking for' },
          { key: 'subreddit', label: 'Subreddit (optional)', type: 'text', placeholder: 'e.g. SaaS' },
          { key: 'timeRange', label: 'Time range', type: 'select', defaultValue: 'week',
            options: [
              { value: 'hour', label: 'Last hour' },
              { value: 'day', label: 'Today' },
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
            ] },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'wikipedia',
        name: 'Wikipedia Categories',
        description:
          'All pages inside a Wikipedia category (e.g. "Software companies of India") — a ready-made company list.',
        category: 'Public company data',
        access: 'FREE',
        criteriaFields: [
          { key: 'category', label: 'Category name', type: 'text',
            placeholder: 'e.g. Software companies of India', defaultValue: 'Software companies of India' },
          { key: 'keyword', label: 'Title contains (optional)', type: 'text', placeholder: 'e.g. Labs' },
          { key: 'namespace', label: 'Namespace', type: 'select', defaultValue: 'page',
            options: [
              { value: 'page', label: 'Articles' },
              { value: 'subcat', label: 'Sub-categories' },
            ] },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 20 },
        ],
      },
      {
        id: 'google-play',
        name: 'Google Play Store Apps',
        description:
          'Apps matching your keyword — each app exposes its developer company.',
        category: 'App stores & marketplaces',
        access: 'SCRAPE',
        note: 'Server-side scraping of the store search page.',
        criteriaFields: [
          { key: 'keyword', label: 'Search term', type: 'text', placeholder: 'e.g. habit tracker', defaultValue: 'habit tracker' },
          { key: 'category', label: 'Category qualifier (optional)', type: 'text', placeholder: 'e.g. health & fitness' },
          { key: 'minRating', label: 'Min rating', type: 'number', defaultValue: 0 },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'apple-app-store',
        name: 'Apple App Store (iTunes Search)',
        description:
          'Apps + their developer companies from the official iTunes Search API.',
        category: 'App stores & marketplaces',
        access: 'FREE',
        criteriaFields: [
          { key: 'keyword', label: 'Search term', type: 'text', placeholder: 'e.g. fintech', defaultValue: 'fintech' },
          { key: 'minRating', label: 'Min rating', type: 'number', defaultValue: 0 },
          { key: 'sort', label: 'Sort by', type: 'select', defaultValue: 'relevance',
            options: [
              { value: 'relevance', label: 'Relevance' },
              { value: 'rating', label: 'Highest rated' },
            ] },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 15 },
        ],
      },
      {
        id: 'apple-podcasts',
        name: 'Apple Podcasts (iTunes Search)',
        description:
          'Podcasts matching your keyword — surface podcasters and indie media companies as leads.',
        category: 'App stores & marketplaces',
        access: 'FREE',
        criteriaFields: [
          { key: 'keyword', label: 'Search term', type: 'text', placeholder: 'e.g. saas', defaultValue: 'saas' },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 15 },
        ],
      },
      {
        id: 'dummyboss',
        name: 'DummyBOSS Company Directory',
        description:
          'Private-company records (domain, industry, city, funding) from a free factual company database.',
        category: 'Public company data',
        access: 'FREE',
        criteriaFields: [
          { key: 'keyword', label: 'Company keyword', type: 'text', placeholder: 'e.g. AI', defaultValue: 'AI' },
          { key: 'location', label: 'City (optional)', type: 'text', placeholder: 'e.g. San Francisco' },
          { key: 'industry', label: 'Industry (optional)', type: 'text', placeholder: 'e.g. software' },
          { key: 'minEmployees', label: 'Min employees', type: 'number', defaultValue: 0 },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 15 },
        ],
      },
      {
        id: 'trustpilot',
        name: 'Trustpilot',
        description:
          'Companies listed on Trustpilot — useful to find businesses with reviews (and scoring themselves).',
        category: 'Business directories',
        access: 'SCRAPE',
        note: 'Server-side scraping; Trustpilot may block datacenter IPs.',
        criteriaFields: [
          { key: 'keyword', label: 'Company keyword', type: 'text', placeholder: 'e.g. delivery', defaultValue: 'delivery' },
          { key: 'domain', label: 'Country site', type: 'select', defaultValue: 'uk',
            options: [
              { value: 'uk', label: 'Trustpilot UK' },
              { value: 'us', label: 'Trustpilot US' },
              { value: 'de', label: 'Trustpilot DE' },
            ] },
          { key: 'minRating', label: 'Min rating', type: 'number', defaultValue: 0 },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
      {
        id: 'yell',
        name: 'Yell.com (UK Businesses)',
        description:
          'UK business directory — 3M+ businesses with phone numbers and addresses.',
        category: 'Business directories',
        access: 'SCRAPE',
        note: 'Server-side scraping of Yell results.',
        criteriaFields: [
          { key: 'keyword', label: 'Service / keyword', type: 'text', placeholder: 'e.g. electrician', defaultValue: 'electrician' },
          { key: 'location', label: 'Town / postcode', type: 'text', placeholder: 'e.g. Leeds', defaultValue: 'Leeds' },
          { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 10 },
        ],
      },
    ];
  }

  private agentsSource(agents: WebAgentDto[]): LeadSource[] {
    return agents
      .filter((agent) => agent.enabled)
      .map((agent) => this.webAgentSource(agent));
  }

  private webAgentSource(agent: WebAgentDto): LeadSource {
    return {
      id: `web-agent-${agent.id}`,
      name: `Web Agent · ${agent.name}`,
      description:
        'Runs on the agent you registered — it searches the open internet and scrapes real companies, emails and phones itself.',
      category: 'Web Agents',
      access: 'FREE',
      criteriaFields: [
        { key: 'industry', label: 'Industry / niche', type: 'text', placeholder: 'e.g. D2C skincare brands', defaultValue: 'D2C skincare brands' },
        { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Mumbai, London, US' },
        { key: 'keywords', label: 'Keywords', type: 'text', placeholder: 'e.g. cold email, founders' },
        { key: 'maxResults', label: 'Max results', type: 'number', defaultValue: 20 },
      ],
    };
  }

  async search(
    sourceId: string,
    criteria: LeadSourceCriteria,
  ): Promise<LeadSourceSearchResult> {
    const source = await this.getCatalog().then((catalog) =>
      catalog.find((s) => s.id === sourceId),
    );

    if (!source) {
      throw new Error(`Unknown lead source: ${sourceId}`);
    }

    let candidates: SourceLeadCandidate[] = [];

    try {
      candidates = await this.fetchBySource(sourceId, criteria);
    } catch (error) {
      this.logger.warn(
        `Lead source ${sourceId} failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new Error(
        `Source "${source.name}" failed to respond. ${source.access === 'SCRAPE' ? 'It may be rate-limiting server-side scraping — try another source or retry in a moment.' : 'Please try again in a moment.'}`,
      );
    }

    return {
      sourceId,
      candidates,
      truncated: candidates.length >= DEFAULT_MAX_RESULTS,
    };
  }

  private maxResultsOf(criteria: LeadSourceCriteria): number {
    const n = Number(criteria.maxResults ?? DEFAULT_MAX_RESULTS);
    return Math.min(Math.max(Number.isFinite(n) ? n : DEFAULT_MAX_RESULTS, 1), MAX_RESULTS_CAP);
  }

  private str(criteria: LeadSourceCriteria, key: string): string {
    const value = criteria[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private num(criteria: LeadSourceCriteria, key: string): number {
    const value = Number(criteria[key]);
    return Number.isFinite(value) ? value : 0;
  }

  private async fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { ...HEADERS, ...headers },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url.slice(0, 120)}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    return JSON.parse(await this.fetchText(url, headers)) as T;
  }

  private htmlDecode(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '');
  }

  private async fetchBySource(
    sourceId: string,
    criteria: LeadSourceCriteria,
  ): Promise<SourceLeadCandidate[]> {
    switch (sourceId) {
      case 'overpass':
        return this.fetchOverpass(criteria);
      case 'nominatim':
        return this.fetchNominatim(criteria);
      case 'google-maps':
        return this.fetchGoogleMaps(criteria);
      case 'bing':
        return this.fetchBing(criteria);
      case 'duckduckgo':
        return this.fetchDuckDuckGo(criteria);
      case 'github':
        return this.fetchGitHub(criteria);
      case 'hn-algolia':
        return this.fetchHnAlgolia(criteria);
      case 'reddit':
        return this.fetchReddit(criteria);
      case 'wikipedia':
        return this.fetchWikipedia(criteria);
      case 'google-play':
        return this.fetchGooglePlay(criteria);
      case 'apple-app-store':
        return this.fetchApple(criteria, 'software');
      case 'apple-podcasts':
        return this.fetchApple(criteria, 'podcast');
      case 'dummyboss':
        return this.fetchDummyboss(criteria);
      case 'trustpilot':
        return this.fetchTrustpilot(criteria);
      case 'yell':
        return this.fetchYell(criteria);
      default:
        if (sourceId.startsWith('web-agent-')) {
          return this.fetchWebAgent(sourceId, criteria);
        }

        throw new Error(`No fetcher for source ${sourceId}`);
    }
  }

  private async fetchWebAgent(
    sourceId: string,
    criteria: LeadSourceCriteria,
  ): Promise<SourceLeadCandidate[]> {
    const agentId = sourceId.slice('web-agent-'.length);

    return this.webAgentService.fetchLeads(agentId, {
      industry: this.str(criteria, 'industry'),
      location: this.str(criteria, 'location'),
      keywords: this.str(criteria, 'keywords'),
      maxResults: this.maxResultsOf(criteria),
    });
  }

  private async fetchOverpass(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const amenity = this.str(criteria, 'amenity') || 'cafe';
    const location = this.str(criteria, 'location') || 'world';
    const keyword = this.str(criteria, 'keyword');
    const country = this.str(criteria, 'country');
    const maxResults = this.maxResultsOf(criteria);

    const nameFilter = keyword
      ? `[name~"${keyword.replace(/["\\]/g, '\\$&')}",i]`
      : '';
    const countryFilter = country
      ? `["name"~"${country.replace(/["\\]/g, '\\$&')}"]`
      : '';

    const overpassQuery =
      `[out:json][timeout:25];area["name"~"${location.replace(/["\\]/g, '\\$&')}"][boundary=administrative]${countryFilter}` +
      `();(node${nameFilter}[amenity=${amenity}](area);way${nameFilter}[amenity=${amenity}](area););out center ${maxResults};`;

    const url =
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    const data = await this.fetchJson<{
      elements: Array<{
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    }>(url);

    return data.elements.map((element) => {
      const tags = element.tags ?? {};
      const lat = element.center?.lat ?? element.lat;
      const lon = element.center?.lon ?? element.lon;

      return {
        id: v4(),
        sourceId: 'overpass',
        platform: 'OpenStreetMap',
        title: tags.name || `${amenity} in ${location}`,
        companyName: tags.name || `${amenity} in ${location}`,
        industry: amenity.replace(/_/g, ' '),
        location: [tags['addr:city'] ?? '', tags['addr:street'] ?? ''].filter(Boolean).join(', ') || undefined,
        website: this.pickUrlTag(tags),
        phone: tags.phone || tags['contact:phone'],
        rating: tags['review:rating'] ? Number(tags['review:rating']) : undefined,
        snippet: tags.description,
        url: lat && lon ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}` : undefined,
      } satisfies SourceLeadCandidate;
    });
  }

  private pickUrlTag(tags: Record<string, string>): string | undefined {
    for (const key of ['contact:website', 'website', 'url', 'facebook']) {
      const value = tags[key];
      if (value && /^https?:\/\//i.test(value)) {
        return value;
      }
    }
    return undefined;
  }

  private async fetchNominatim(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const location = this.str(criteria, 'location');
    const country = this.str(criteria, 'country');
    const maxResults = this.maxResultsOf(criteria);

    const query = [keyword, location, country].filter(Boolean).join(', ');

    const url =
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&extratags=1&limit=${maxResults}` +
      `&q=${encodeURIComponent(query)}`;

    const data = await this.fetchJson<
      Array<{
        name: string;
        display_name: string;
        type: string;
        lat: string;
        lon: string;
        extratags?: Record<string, string>;
      }>
    >(url, { Referer: 'https://os20.local' });

    return data.map((place) => {
      const tags = place.extratags ?? {};

      return {
        id: v4(),
        sourceId: 'nominatim',
        platform: 'OpenStreetMap',
        title: place.name || place.display_name.split(',')[0],
        companyName: place.name || place.display_name.split(',')[0],
        industry: place.type,
        location: place.display_name,
        website: this.pickUrlTag(tags),
        phone: tags.phone,
        rating: tags.rating ? Number(tags.rating) : undefined,
        snippet: place.display_name,
        url: `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`,
      } satisfies SourceLeadCandidate;
    });
  }

  private async fetchGoogleMaps(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const location = this.str(criteria, 'location');
    const minRating = this.num(criteria, 'minRating');
    const maxResults = this.maxResultsOf(criteria);

    const query = [keyword, location].filter(Boolean).join(' ');
    const html = await this.fetchText(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`,
    );

    return this.parseGoogleMapsResults(html, minRating, maxResults);
  }

  private parseGoogleMapsResults(
    html: string,
    minRating: number,
    maxResults: number,
  ): SourceLeadCandidate[] {
    const stateMatch = html.match(/window\.APP_INITIALIZATION_STATE=(\[.*?\]);/);

    if (!stateMatch?.[1]) {
      return [];
    }

    const candidates: SourceLeadCandidate[] = [];
    const seen = new Set<string>();

    const scan = (value: unknown, depth: number): void => {
      if (depth > 8 || candidates.length >= maxResults || !Array.isArray(value)) {
        return;
      }

      if (typeof value[0] === 'string' && value.length > 6) {
        const text = JSON.stringify(value);
        const hasCity = /[A-Z][a-z]+, [A-Z]{2}\s|, \d{3,}/.test(text);

        if (hasCity && text.length < 600) {
          const candidate = this.buildMapsCandidate(value);

          if (candidate && !seen.has(candidate.title.toLowerCase())) {
            seen.add(candidate.title.toLowerCase());
            candidates.push(candidate);
          }
        }
      }

      for (const child of value) {
        if (Array.isArray(child)) {
          scan(child, depth + 1);
        }
      }
    };

    try {
      scan(JSON.parse(stateMatch[1][0] === '[' ? stateMatch[1] : `[${stateMatch[1]}]`), 0);
    } catch {
      return [];
    }

    return candidates.filter(
      (candidate) => candidate.rating === undefined || candidate.rating >= minRating,
    );
  }

  private buildMapsCandidate(value: unknown[]): SourceLeadCandidate | null {
    const strings = value.filter((v) => typeof v === 'string') as string[];

    const name = strings.find((s) => s.length >= 2 && s.length <= 80 && !/^(https?:\/\/|http)/.test(s));

    if (!name || value[1] === 1 || value[1] === '1') {
      return null;
    }

    const numbers = value.filter((v) => typeof v === 'number') as number[];
    const rating = numbers.find((n) => n >= 2 && n <= 5);

    const website = strings.find((s) => /^https?:\/\//.test(s));
    const phone = strings.find((s) => /^\+?\d[\d\s().-]{7,}$/.test(s));
    const address =
      strings.find((s) => s.includes(',') && s.length > 10 && s.length < 120 && /\d/.test(s)) ?? undefined;

    return {
      id: v4(),
      sourceId: 'google-maps',
      platform: 'Google Maps',
      title: name,
      companyName: name,
      rating: rating ?? undefined,
      website,
      phone,
      location: address,
      snippet: address ? `${address}${phone ? ` · ${phone}` : ''}` : undefined,
      url: `https://www.google.com/maps/search/${encodeURIComponent(name)}`,
    } satisfies SourceLeadCandidate;
  }

  private async fetchBing(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const location = this.str(criteria, 'location');
    const siteFilter = this.str(criteria, 'siteFilter');
    const maxResults = this.maxResultsOf(criteria);

    const query = [keyword, location].filter(Boolean).join(' ');
    const url =
      `https://www.bing.com/search?q=${encodeURIComponent(query)}` +
      (siteFilter ? `+site:${encodeURIComponent(siteFilter)}` : '') +
      `&count=${Math.min(maxResults, 20)}`;

    const html = await this.fetchText(url);

    const resultBlocks = html.split('<li class="b_algo');

    return resultBlocks.slice(1, maxResults + 1).map((block): SourceLeadCandidate | null => {
      const titleMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);

      const title = this.htmlDecode(titleMatch?.[2]?.replace(/<[^>]+>/g, '') ?? '').trim();
      const url = titleMatch?.[1] ?? '';

      if (!title) {
        return null;
      }

      return {
        id: v4(),
        sourceId: 'bing',
        platform: 'Bing',
        title,
        companyName: title,
        snippet: this.htmlDecode(snippetMatch?.[1]?.replace(/<[^>]+>/g, '') ?? '').slice(0, 240) || undefined,
        url,
        website: url || undefined,
      } satisfies SourceLeadCandidate;
    }).filter((candidate): candidate is SourceLeadCandidate => candidate !== null);
  }

  private async fetchDuckDuckGo(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const location = this.str(criteria, 'location');
    const fileType = this.str(criteria, 'fileType');
    const maxResults = this.maxResultsOf(criteria);

    const query = [keyword, location].filter(Boolean).join(' ') + (fileType ? ` filetype:${fileType}` : '');
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const html = await this.fetchText(url);

    const resultBlocks = html.split('class="result results_links');

    return resultBlocks.slice(1, maxResults + 1).map((block): SourceLeadCandidate | null => {
      const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snipMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) ??
        block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);

      const title = this.htmlDecode(titleMatch?.[2]?.replace(/<[^>]+>/g, '') ?? '').trim();
      let url = titleMatch?.[1] ?? '';

      if (url.startsWith('//')) {
        url = `https:${url}`;
      }

      if (!title) {
        return null;
      }

      return {
        id: v4(),
        sourceId: 'duckduckgo',
        platform: 'DuckDuckGo',
        title,
        companyName: title,
        snippet: this.htmlDecode(snipMatch?.[1]?.replace(/<[^>]+>/g, '') ?? '').slice(0, 240) || undefined,
        url: url || undefined,
        website: url || undefined,
      } satisfies SourceLeadCandidate;
    }).filter((candidate): candidate is SourceLeadCandidate => candidate !== null);
  }

  private async fetchGitHub(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const language = this.str(criteria, 'language');
    const minStars = this.num(criteria, 'minStars');
    const sort = this.str(criteria, 'sort') || 'stars';
    const maxResults = this.maxResultsOf(criteria);

    const qualifiers = [
      encodeURIComponent(keyword),
      language ? `language:${encodeURIComponent(language)}` : '',
      minStars > 0 ? `stars:>${Math.floor(minStars)}` : '',
    ].filter(Boolean).join('+');

    const url =
      `https://api.github.com/search/repositories?q=${qualifiers}&sort=${sort}&order=desc&per_page=${Math.min(maxResults, 30)}`;

    const data = await this.fetchJson<{
      items: Array<{
        full_name: string;
        html_url: string;
        description: string | null;
        language: string | null;
        stargazers_count: number;
        owner?: { type?: string; login?: string };
      }>;
    }>(url, { Accept: 'application/vnd.github+json' });

    return data.items.map((repo) => ({
      id: v4(),
      sourceId: 'github',
      platform: 'GitHub',
      title: repo.full_name,
      companyName:
        repo.owner?.type === 'Organization' ? repo.owner.login ?? repo.full_name : repo.full_name,
      industry: 'Software',
      website: repo.html_url,
      snippet: repo.description ?? undefined,
      url: repo.html_url,
      rating: undefined,
    }));
  }

  private async fetchHnAlgolia(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const storyType = this.str(criteria, 'storyType') || 'story';
    const minPoints = this.num(criteria, 'minPoints');
    const timeRange = this.str(criteria, 'timeRange') || 'all';
    const maxResults = this.maxResultsOf(criteria);

    const index = storyType === 'story' ? 'search' : 'search_by_date';
    const tags = storyType === 'story' ? 'story' : storyType;
    const dateFilter =
      timeRange === 'month' ? '&numericFilters=created_at_i>%d' : '';

    const url =
      `https://hn.algolia.com/api/v1/${index}?query=${encodeURIComponent(keyword)}` +
      `&tags=${tags}&hitsPerPage=${Math.min(maxResults, 20)}` +
      (minPoints > 0 ? `&numericFilters=points>${Math.floor(minPoints)}` : '') +
      (dateFilter ? dateFilter.replace('%d', String(Math.floor(Date.now() / 1000) - 30 * 86400)) : '');

    const data = await this.fetchJson<{
      hits: Array<{
        title?: string;
        url?: string;
        points?: number;
        objectID?: string;
        author?: string;
      }>;
    }>(url);

    return data.hits.map((hit) => ({
      id: v4(),
      sourceId: 'hn-algolia',
      platform: 'Hacker News',
      title: hit.title ?? `HN ${hit.objectID ?? ''}`,
      companyName: hit.title ?? `HN item ${hit.objectID ?? ''}`,
      industry: 'Startups & tech',
      website: hit.url,
      snippet: `${hit.points ?? 0} points · by ${hit.author ?? 'unknown'}`,
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
      rating: undefined,
    }));
  }

  private async fetchReddit(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const subreddit = this.str(criteria, 'subreddit');
    const timeRange = this.str(criteria, 'timeRange') || 'week';
    const maxResults = this.maxResultsOf(criteria);

    const url =
      `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}` +
      `&limit=${Math.min(maxResults, 25)}&sort=relevance&t=${timeRange}` +
      (subreddit ? `&restrict_sr=1` : '');

    const data = await this.fetchJson<{
      data?: {
        children?: Array<{
          data?: {
            title?: string;
            permalink?: string;
            subreddit?: string;
            selftext?: string;
            num_comments?: number;
            url?: string;
          };
        }>;
      };
    }>(url, { 'User-Agent': 'os20-leadfinder/1.0' });

    return (data.data?.children ?? []).map((child) => ({
      id: v4(),
      sourceId: 'reddit',
      platform: 'Reddit',
      title: child.data?.title ?? 'Reddit post',
      companyName: child.data?.title ?? 'Reddit post',
      industry: `r/${child.data?.subreddit ?? 'all'}`,
      snippet: (child.data?.selftext?.slice(0, 240) || undefined),
      url: child.data?.url ?? `https://reddit.com${child.data?.permalink ?? ''}`,
      website: child.data?.url ?? `https://reddit.com${child.data?.permalink ?? ''}`,
      rating: undefined,
    }));
  }

  private async fetchWikipedia(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const category = this.str(criteria, 'category');
    const keyword = this.str(criteria, 'keyword');
    const namespace = this.str(criteria, 'namespace') || 'page';
    const maxResults = this.maxResultsOf(criteria);

    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers' +
      `&cmtitle=${encodeURIComponent(`Category:${category}`)}` +
      `&cmlimit=${Math.min(maxResults, 50)}&cmtype=${namespace}`;

    const data = await this.fetchJson<{
      query?: {
        categorymembers?: Array<{ title?: string }>;
      };
    }>(url);

    return (data.query?.categorymembers ?? [])
      .filter((member) => !keyword || (member.title ?? '').toLowerCase().includes(keyword.toLowerCase()))
      .map((member) => ({
        id: v4(),
        sourceId: 'wikipedia',
        platform: 'Wikipedia',
        title: member.title ?? '',
        companyName: member.title ?? '',
        industry: 'From category',
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((member.title ?? '').replace(/ /g, '_'))}`,
        website: `https://en.wikipedia.org/wiki/${encodeURIComponent((member.title ?? '').replace(/ /g, '_'))}`,
        snippet: `Category: ${category}`,
        rating: undefined,
      }));
  }

  private async fetchGooglePlay(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const categoryQualifier = this.str(criteria, 'category');
    const maxResults = this.maxResultsOf(criteria);

    const url =
      `https://play.google.com/store/search?q=${encodeURIComponent(keyword)}&c=apps&hl=en` +
      (categoryQualifier ? `&cat=${encodeURIComponent(categoryQualifier)}` : '');

    const html = await this.fetchText(url);

    const match = html.match(/<div\s+[^>]*aria-label="([^"]{3,120})"/g) ?? [];
    const names = match
      .map((m) => m.match(/aria-label="([^"]{3,120})"/)?.[1]?.trim() ?? '')
      .filter((n, index, all) => n && all.indexOf(n) === index)
      .slice(0, maxResults);

    if (names.length === 0) {
      throw new Error('Google Play returned no parseable results');
    }

    return names.map((name) => ({
      id: v4(),
      sourceId: 'google-play',
      platform: 'Google Play',
      title: name,
      companyName: name,
      industry: 'Mobile apps',
      url: `https://play.google.com/store/search?q=${encodeURIComponent(name)}&c=apps`,
      website: `https://play.google.com/store/search?q=${encodeURIComponent(name)}&c=apps`,
      snippet: `Play Store app: ${name}`,
      rating: undefined,
    }));
  }

  private async fetchApple(criteria: LeadSourceCriteria, entity: string): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const minRating = this.num(criteria, 'minRating');
    const maxResults = this.maxResultsOf(criteria);

    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(keyword)}` +
      `&entity=${entity}&limit=${Math.min(maxResults, 50)}&country=US`;

    const data = await this.fetchJson<{
      results: Array<{
        trackName?: string;
        trackViewUrl?: string;
        sellerName?: string;
        sellerUrl?: string;
        primaryGenreName?: string;
        averageUserRating?: number;
        artistName?: string;
        description?: string;
      }>;
    }>(url);

    return data.results
      .filter(
        (app) => minRating <= 0 || (app.averageUserRating ?? 0) >= minRating,
      )
      .map((app) => ({
        id: v4(),
        sourceId: entity === 'software' ? 'apple-app-store' : 'apple-podcasts',
        platform: entity === 'software' ? 'Apple App Store' : 'Apple Podcasts',
        title: app.trackName ?? app.artistName ?? 'Unknown',
        companyName: app.sellerName ?? app.artistName ?? app.trackName ?? 'Unknown',
        industry: app.primaryGenreName ?? 'Mobile',
        website: app.sellerUrl ?? app.trackViewUrl,
        snippet: app.description?.slice(0, 240),
        url: app.trackViewUrl,
        rating: app.averageUserRating,
      }));
  }

  private async fetchDummyboss(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const location = this.str(criteria, 'location');
    const industry = this.str(criteria, 'industry');
    const minEmployees = this.num(criteria, 'minEmployees');
    const maxResults = this.maxResultsOf(criteria);

    const query = [keyword, location, industry].filter(Boolean).join(' ');

    const url =
      `https://dummyboss.com/api/companies/search?query=${encodeURIComponent(query)}&limit=${maxResults}`;

    const data = await this.fetchJson<{
      companies?: Array<{
        name?: string;
        domain?: string;
        description?: string;
        city?: string;
        industry?: string;
        employees_count?: number;
      }>;
      results?: Array<{
        name?: string;
        domain?: string;
        description?: string;
        city?: string;
      }>;
    }>(url);

    const companies: Array<{
      name?: string;
      domain?: string;
      description?: string;
      city?: string;
      industry?: string;
      employees_count?: number;
    }> = data.companies ?? data.results ?? [];

    return companies
      .filter(
        (company) =>
          minEmployees <= 0 || (company.employees_count ?? 0) >= minEmployees,
      )
      .map((company) => ({
        id: v4(),
        sourceId: 'dummyboss',
        platform: 'DummyBOSS',
        title: company.name ?? 'Unknown company',
        companyName: company.name ?? 'Unknown company',
        industry: company.industry ?? 'Company',
        location: company.city,
        website: company.domain
          ? /^https?:\/\//i.test(company.domain)
            ? company.domain
            : `https://${company.domain}`
          : undefined,
        snippet: company.description ?? undefined,
        url: company.domain
          ? `https://${company.domain.replace(/^https?:\/\//i, '')}`
          : undefined,
        rating: undefined,
      }));
  }

  private async fetchTrustpilot(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const domain = this.str(criteria, 'domain') || 'uk';
    const minRating = this.num(criteria, 'minRating');
    const maxResults = this.maxResultsOf(criteria);

    const url =
      `https://${domain}.trustpilot.com/search?query=${encodeURIComponent(keyword)}`;

    const html = await this.fetchText(url);

    const cards = html.split('class="businessUnit');

    const candidates = cards
      .slice(1, maxResults + 1)
      .map((card): SourceLeadCandidate | null => {
        const title = this.htmlDecode(
          card.match(/class="[^"]*businessUnitInfoHeader[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1]?.replace(/<[^>]+>/g, '') ?? '',
        ).trim();

      const link = card.match(/href="(\/review\/[^"]+)"/)?.[1];

      if (!title) {
        return null;
      }

      const ratingMatch = card.match(/alt="([\d.]+) out of 5"/);

      return {
        id: v4(),
        sourceId: 'trustpilot',
        platform: 'Trustpilot',
        title,
        companyName: title,
        industry: 'Reviewed business',
        rating: ratingMatch ? Number(ratingMatch[1]) : undefined,
        url: link ? `https://${domain}.trustpilot.com${link}` : undefined,
        website: link ? `https://${domain}.trustpilot.com${link}` : undefined,
        snippet: `Trustpilot review page · ${domain}.trustpilot.com`,
      } satisfies SourceLeadCandidate;
    }).filter((candidate): candidate is SourceLeadCandidate => candidate !== null);

    return candidates.filter(
      (candidate) => candidate.rating === undefined || candidate.rating >= minRating,
    );
  }

  private async fetchYell(criteria: LeadSourceCriteria): Promise<SourceLeadCandidate[]> {
    const keyword = this.str(criteria, 'keyword');
    const location = this.str(criteria, 'location');
    const maxResults = this.maxResultsOf(criteria);

    const url =
      `https://www.yell.com/ucs/UcsSearchAction.do?keywords=${encodeURIComponent(keyword)}` +
      `&location=${encodeURIComponent(location)}&pageNum=1`;

    const html = await this.fetchText(url);

    const blocks = html.split('class="businessCapsule');

    return blocks.slice(1, maxResults + 1).map((block): SourceLeadCandidate | null => {
      const titleMatch = block.match(/class="business-businessTitle"[^>]*>([\s\S]*?)<\/h2>/);

      const title = this.htmlDecode(
        titleMatch?.[1]?.replace(/<[^>]+>/g, '') ?? '',
      ).trim();

      const nameMatch = block.match(/<span itemprop="name">([\s\S]*?)<\/span>/);

      const name = title || this.htmlDecode(nameMatch?.[1] ?? '').trim();

      if (!name) {
        return null;
      }

      const phone = block.match(/itemprop="telephone"[^>]*>([\s\S]*?)<\//)?.[1]?.trim();
      const address = block.match(/itemprop="streetAddress"[^>]*>([\s\S]*?)<\//)?.[1]?.trim();
      const website = block.match(/data-mouseover-url="(https:\/\/[^"]+)"/)?.[1];
      const link = block.match(/href="((?:https:)?\/\/[^"]*\/gc\/[^"]*)"/)?.[1];

      return {
        id: v4(),
        sourceId: 'yell',
        platform: 'Yell.com',
        title: name,
        companyName: name,
        industry: keyword,
        location: address || location || undefined,
        phone: this.htmlDecode(phone ?? '') || undefined,
        website: website ?? undefined,
        url: link ? (link.startsWith('http') ? link : `https:${link}`) : undefined,
        snippet: address,
        rating: undefined,
      } satisfies SourceLeadCandidate;
    }).filter((candidate): candidate is SourceLeadCandidate => candidate !== null);
  }
}