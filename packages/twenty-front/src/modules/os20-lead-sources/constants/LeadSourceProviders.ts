import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

export type LeadSourceProviderId =
  | 'google_places'
  | 'tavily'
  | 'firecrawl'
  | 'brave'
  | 'serpapi';

export type LeadSourceProvider = {
  id: LeadSourceProviderId;
  label: string;
  description: MessageDescriptor;
  keyUrl: string;
  isWebSearch: boolean;
};

// Ids must match the server's normalizeProvider() names in
// web-search-tool.service.ts.
export const LEAD_SOURCE_PROVIDERS: LeadSourceProvider[] = [
  {
    id: 'google_places',
    label: 'Google Places',
    description: msg`Optional. Finds real local businesses with their website and phone number.`,
    keyUrl: 'https://console.cloud.google.com/apis/credentials',
    isWebSearch: false,
  },
  {
    id: 'tavily',
    label: 'Tavily',
    description: msg`Web search built for AI agents.`,
    keyUrl: 'https://app.tavily.com',
    isWebSearch: true,
  },
  {
    id: 'firecrawl',
    label: 'Firecrawl',
    description: msg`Web search with page content included.`,
    keyUrl: 'https://www.firecrawl.dev/app',
    isWebSearch: true,
  },
  {
    id: 'brave',
    label: 'Brave Search',
    description: msg`Independent web search index.`,
    keyUrl: 'https://brave.com/search/api/',
    isWebSearch: true,
  },
  {
    id: 'serpapi',
    label: 'SerpAPI',
    description: msg`Google search results through an API.`,
    keyUrl: 'https://serpapi.com/manage-api-key',
    isWebSearch: true,
  },
];
