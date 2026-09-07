import { Injectable, Logger } from '@nestjs/common';

import { WebSearchApiService } from '../web-search-api.service';

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

export const normalizeProvider = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

@Injectable()
export class WebSearchToolService {
  private readonly logger = new Logger(WebSearchToolService.name);

  constructor(private readonly credentialService: WebSearchApiService) {}

  async search(
    query: string,
    maxResults = 10,
  ): Promise<WebSearchResult[]> {
    const credentials = await this.credentialService.list();

    if (credentials.length === 0) {
      return [];
    }

    const match = (name: string) =>
      credentials.find((c) => normalizeProvider(c.provider) === name);

    const tavily = match('tavily');
    if (tavily) {
      return this.searchTavily(tavily.apiKey, query, maxResults);
    }

    const firecrawl = match('firecrawl');
    if (firecrawl) {
      return this.searchFirecrawl(firecrawl.apiKey, query, maxResults);
    }

    const brave = match('brave');
    if (brave) {
      return this.searchBrave(brave.apiKey, query, maxResults);
    }

    const serpapi = match('serpapi');
    if (serpapi) {
      return this.searchSerpApi(serpapi.apiKey, query, maxResults);
    }

    return this.searchTavily(credentials[0].apiKey, query, maxResults);
  }

  private async searchTavily(
    apiKey: string,
    query: string,
    maxResults: number,
  ): Promise<WebSearchResult[]> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        title: string;
        url: string;
        content: string;
      }>;
    };

    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 300) ?? '',
      domain: new URL(r.url).hostname,
    }));
  }

  private async searchBrave(
    apiKey: string,
    query: string,
    maxResults: number,
  ): Promise<WebSearchResult[]> {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');

    url.searchParams.set('q', query);
    url.searchParams.set('count', String(maxResults));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave search failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      web?: {
        results?: Array<{
          title: string;
          url: string;
          description: string;
        }>;
      };
    };

    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description?.slice(0, 300) ?? '',
      domain: new URL(r.url).hostname,
    }));
  }

  private async searchSerpApi(
    apiKey: string,
    query: string,
    maxResults: number,
  ): Promise<WebSearchResult[]> {
    const url = new URL('https://serpapi.com/search.json');

    url.searchParams.set('q', query);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('num', String(maxResults));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`SerpAPI search failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      organic_results?: Array<{
        title: string;
        link: string;
        snippet: string;
      }>;
    };

    return (data.organic_results ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet?.slice(0, 300) ?? '',
      domain: new URL(r.link).hostname,
    }));
  }

  private async searchFirecrawl(
    apiKey: string,
    query: string,
    maxResults: number,
  ): Promise<WebSearchResult[]> {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, limit: maxResults }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl search failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{
        title: string;
        url: string;
        description: string;
      }>;
    };

    return (data.data ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url,
      snippet: r.description?.slice(0, 300) ?? '',
      domain: new URL(r.url).hostname,
    }));
  }
}