export const GOOGLE_PLACES_PROVIDER_ID = 'google_places';

export const WEB_SEARCH_PROVIDER_IDS = [
  'tavily',
  'firecrawl',
  'brave',
  'serpapi',
] as const;

// Every provider the key store accepts. google_places is a lead source, not a
// web search engine, so the web search tool never uses it.
export const WEB_SEARCH_API_PROVIDER_IDS = [
  ...WEB_SEARCH_PROVIDER_IDS,
  GOOGLE_PLACES_PROVIDER_ID,
] as const;

export type WebSearchApiProviderId =
  (typeof WEB_SEARCH_API_PROVIDER_IDS)[number];

export const normalizeProvider = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

export const toWebSearchApiProviderId = (
  name: string,
): WebSearchApiProviderId | undefined =>
  WEB_SEARCH_API_PROVIDER_IDS.find(
    (id) => normalizeProvider(id) === normalizeProvider(name),
  );
