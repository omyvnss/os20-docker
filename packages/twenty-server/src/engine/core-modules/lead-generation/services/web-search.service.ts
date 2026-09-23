import { Injectable, Logger } from '@nestjs/common';

import {
  type IdealCustomerProfile,
  type LeadSearchStats,
  type SearchResult,
} from '../interfaces/lead-generation.interface';
import { WEB_SEARCH_QUERY_EXCLUSIONS } from '../utils/lead-candidate.util';
import { WebSearchToolService } from 'src/engine/core-modules/web-search-apis/services/web-search-tool.service';

const DUCKDUCKGO_TIMEOUT_MS = 10_000;

type SearchOutcome = {
  results: SearchResult[];
  source: LeadSearchStats['searchSource'];
  blocked: boolean;
};

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(private readonly webSearchToolService: WebSearchToolService) {}

  // Aimed at company homepages rather than articles about companies.
  buildSearchQueries(icp: IdealCustomerProfile): string[] {
    const topic =
      [icp.keywords?.join(' '), icp.industry]
        .filter(Boolean)
        .join(' ')
        .trim() || 'companies';
    const place = icp.location ? ` ${icp.location}` : '';

    return [
      ...new Set([
        `${topic} company${place} ${WEB_SEARCH_QUERY_EXCLUSIONS}`,
        `${topic}${place} official website ${WEB_SEARCH_QUERY_EXCLUSIONS}`,
      ]),
    ];
  }

  // Places queries read best as "<what> in <where>".
  buildPlacesQuery(icp: IdealCustomerProfile): string {
    const topic =
      [icp.keywords?.join(' '), icp.industry]
        .filter(Boolean)
        .join(' ')
        .trim() || 'businesses';

    return icp.location ? `${topic} in ${icp.location}` : topic;
  }

  // Sequential on purpose: parallel DuckDuckGo requests trigger its bot check.
  async searchMany(
    queries: string[],
    maxResultsPerQuery: number,
  ): Promise<SearchOutcome> {
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    let usedSearchApi = false;
    let blocked = false;

    for (const query of queries) {
      const outcome = await this.search(query, maxResultsPerQuery);

      usedSearchApi ||= outcome.source === 'search-api';
      blocked ||= outcome.blocked;

      for (const result of outcome.results) {
        if (!seen.has(result.url)) {
          seen.add(result.url);
          results.push(result);
        }
      }
    }

    const source = usedSearchApi
      ? 'search-api'
      : results.length > 0
        ? 'duckduckgo'
        : 'none';

    return { results, source, blocked: blocked && results.length === 0 };
  }

  // Uses the workspace's saved search API key when there is one, otherwise
  // DuckDuckGo. Returns an empty list rather than placeholder results.
  async search(query: string, maxResults = 20): Promise<SearchOutcome> {
    try {
      const keyedResults = await this.webSearchToolService.search(
        query,
        maxResults,
      );

      if (keyedResults.length > 0) {
        return {
          results: keyedResults.map(({ title, url, snippet }) => ({
            title,
            url,
            snippet,
          })),
          source: 'search-api',
          blocked: false,
        };
      }
    } catch (error) {
      this.logger.warn(`Search API failed, using DuckDuckGo: ${error}`);
    }

    const encodedQuery = encodeURIComponent(query);
    const lite = await this.fetchHtml(
      `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`,
    );
    const liteResults = this.parseLinks(
      lite.html,
      /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g,
      maxResults,
    );

    if (liteResults.length > 0) {
      return { results: liteResults, source: 'duckduckgo', blocked: false };
    }

    const html = await this.fetchHtml(
      `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
    );
    const results = this.parseLinks(
      html.html,
      /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g,
      maxResults,
    );

    return {
      results,
      source: results.length > 0 ? 'duckduckgo' : 'none',
      blocked: lite.blocked || html.blocked,
    };
  }

  private async fetchHtml(
    url: string,
  ): Promise<{ html: string; blocked: boolean }> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(DUCKDUCKGO_TIMEOUT_MS),
      });
      const html = await response.text();
      // DuckDuckGo answers bots with HTTP 202 and an "anomaly" challenge page.
      const blocked = response.status !== 200 || /anomaly/i.test(html);

      if (blocked) {
        this.logger.warn(`DuckDuckGo blocked the request (${response.status})`);
      }

      return { html: blocked ? '' : html, blocked };
    } catch (error) {
      this.logger.warn(`DuckDuckGo request failed: ${error}`);

      return { html: '', blocked: false };
    }
  }

  private parseLinks(
    html: string,
    pattern: RegExp,
    maxResults: number,
  ): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [, rawUrl, title] of html.matchAll(pattern)) {
      const url = this.decodeDuckDuckGoUrl(rawUrl);

      if (
        !url.startsWith('http') ||
        url.includes('duckduckgo.com') ||
        results.some((result) => result.url === url)
      ) {
        continue;
      }

      results.push({ title: title.trim(), url, snippet: '' });

      if (results.length >= maxResults) {
        break;
      }
    }

    return results;
  }

  private decodeDuckDuckGoUrl(rawUrl: string): string {
    const url = rawUrl.replace(/&amp;/g, '&');

    if (!url.includes('duckduckgo.com/l/')) {
      return url;
    }

    return new URLSearchParams(url.split('?')[1] ?? '').get('uddg') ?? url;
  }
}
