import { type SelectOption } from 'twenty-ui/input';

export type SearchProviderId = 'tavily' | 'firecrawl' | 'brave' | 'serpapi';

// Values must match the server's normalizeProvider() names in
// web-search-tool.service.ts.
export const SEARCH_PROVIDERS: SelectOption<SearchProviderId>[] = [
  { value: 'tavily', label: 'Tavily' },
  { value: 'firecrawl', label: 'Firecrawl' },
  { value: 'brave', label: 'Brave Search' },
  { value: 'serpapi', label: 'SerpAPI' },
];
