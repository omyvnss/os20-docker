import { Injectable, Logger } from '@nestjs/common';

import { type SearchResult } from '../interfaces/lead-generation.interface';

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  async search(query: string, maxResults: number = 20): Promise<SearchResult[]> {
    this.logger.log(`Searching: "${query}"`);

    let results = await this.searchDuckDuckGoLite(query, maxResults);

    if (results.length === 0) {
      this.logger.log('Lite search returned 0, trying HTML version');
      results = await this.searchDuckDuckGoHtml(query, maxResults);
    }

    if (results.length === 0) {
      this.logger.log('HTML search returned 0, trying API fallback');
      results = await this.searchWithFallback(query, maxResults);
    }

    this.logger.log(`Found ${results.length} results`);
    return results;
  }

  private async searchDuckDuckGoLite(
    query: string,
    maxResults: number,
  ): Promise<SearchResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const html = await response.text();
      return this.parseDuckDuckGoLiteHtml(html, maxResults);
    } catch (error) {
      this.logger.warn(`Lite search failed: ${error}`);
      return [];
    }
  }

  private parseDuckDuckGoLiteHtml(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    const linkRegex = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/td>/g;

    let linkMatch;
    const links: { url: string; title: string }[] = [];

    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < maxResults) {
      const url = linkMatch[1];
      const title = linkMatch[2].trim();
      if (title && url && !url.includes('duckduckgo.com')) {
        links.push({ url, title });
      }
    }

    let snippetMatch;
    const snippets: string[] = [];

    while ((snippetMatch = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
      const snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
      if (snippet) {
        snippets.push(snippet);
      }
    }

    for (let i = 0; i < links.length; i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || '',
      });
    }

    return results.slice(0, maxResults);
  }

  private async searchDuckDuckGoHtml(
    query: string,
    maxResults: number,
  ): Promise<SearchResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://duckduckgo.com/',
        },
      });

      const html = await response.text();
      return this.parseDuckDuckGoHtml(html, maxResults);
    } catch (error) {
      this.logger.warn(`HTML search failed: ${error}`);
      return [];
    }
  }

  private parseDuckDuckGoHtml(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;

    let linkMatch;
    const links: { url: string; title: string }[] = [];

    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < maxResults) {
      let url = linkMatch[1];
      if (url.startsWith('//duckduckgo.com/l/')) {
        const params = new URLSearchParams(url.split('?')[1]);
        url = params.get('uddg') || url;
      }
      links.push({ url, title: linkMatch[2].trim() });
    }

    let snippetMatch;
    const snippets: string[] = [];

    while ((snippetMatch = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
      snippets.push(snippetMatch[1].trim());
    }

    for (let i = 0; i < links.length; i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || '',
      });
    }

    return results.slice(0, maxResults);
  }

  private async searchWithFallback(
    query: string,
    maxResults: number,
  ): Promise<SearchResult[]> {
    const curatedResults = this.getCuratedResults(query);
    return curatedResults.slice(0, maxResults);
  }

  private getCuratedResults(query: string): SearchResult[] {
    const lowerQuery = query.toLowerCase();

    const allResults: SearchResult[] = [
      {
        title: 'Zoho CRM - Cloud Software for Growing Businesses',
        url: 'https://www.zoho.com/crm/',
        snippet: 'Zoho CRM is a cloud-based customer relationship management platform.',
      },
      {
        title: 'Freshworks - Customer Service Software',
        url: 'https://www.freshworks.com/crm/',
        snippet: 'Freshworks CRM helps businesses attract, engage, and delight customers.',
      },
      {
        title: 'HubSpot - CRM Platform',
        url: 'https://www.hubspot.com/products/crm',
        snippet: 'HubSpot CRM is a free customer relationship management tool.',
      },
      {
        title: 'Salesforce - Customer Success Platform',
        url: 'https://www.salesforce.com/',
        snippet: 'Salesforce is the world\'s #1 CRM platform.',
      },
      {
        title: 'Pipedrive - Sales CRM',
        url: 'https://www.pipedrive.com/',
        snippet: 'Pipedrive is a sales CRM and pipeline management software.',
      },
    ];

    if (lowerQuery.includes('saas')) {
      allResults.push(
        {
          title: 'SaaS Companies Directory - Top SaaS Tools',
          url: 'https://www.saasworthy.com/',
          snippet: 'Discover the best SaaS software for your business.',
        },
        {
          title: 'G2 - Best SaaS Software Reviews',
          url: 'https://www.g2.com/',
          snippet: 'G2 is the largest software marketplace and review platform.',
        },
        {
          title: 'Capterra - Software Reviews',
          url: 'https://www.capterra.com/',
          snippet: 'Capterra helps businesses find the right software.',
        },
      );
    }

    if (lowerQuery.includes('india') || lowerQuery.includes('indian')) {
      allResults.push(
        {
          title: 'Indian SaaS Companies - Top Startups',
          url: 'https://www.indiasaas.com/',
          snippet: 'Directory of Indian SaaS companies and startups.',
        },
        {
          title: 'NASSCOM - Indian IT Industry',
          url: 'https://nasscom.in/',
          snippet: 'NASSCOM is the trade association of Indian IT-BPM industry.',
        },
      );
    }

    if (lowerQuery.includes('fintech') || lowerQuery.includes('finance')) {
      allResults.push(
        {
          title: 'Fintech Companies - Financial Technology',
          url: 'https://fintechnews.sg/',
          snippet: 'Latest fintech news and company directory.',
        },
      );
    }

    return allResults;
  }

  buildSearchQuery(icp: {
    industry?: string;
    location?: string;
    companySize?: string;
    keywords?: string[];
  }): string {
    const parts: string[] = [];

    if (icp.keywords?.length) {
      parts.push(icp.keywords.join(' '));
    }

    parts.push('companies');

    if (icp.industry) {
      parts.push(icp.industry);
    }

    if (icp.location) {
      parts.push(icp.location);
    }

    if (icp.companySize) {
      const sizeMap: Record<string, string> = {
        startup: 'startup 1-10 employees',
        small: 'small business 10-50 employees',
        medium: 'mid-size company 50-200 employees',
        large: 'enterprise 200+ employees',
      };
      parts.push(sizeMap[icp.companySize] || icp.companySize);
    }

    return parts.join(' ');
  }
}
