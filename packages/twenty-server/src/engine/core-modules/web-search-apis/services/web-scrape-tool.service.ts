import { Injectable, Logger } from '@nestjs/common';

import { WebSearchApiService } from '../web-search-api.service';
import { normalizeProvider } from './web-search-tool.service';

export type WebScrapeResult = {
  url: string;
  title: string;
  content: string;
  emails: string[];
  phones: string[];
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX =
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;

@Injectable()
export class WebScrapeToolService {
  private readonly logger = new Logger(WebScrapeToolService.name);

  constructor(
    private readonly credentialService: WebSearchApiService,
  ) {}

  async scrape(url: string): Promise<WebScrapeResult> {
    const content = await this.fetchContent(url);

    const emails = [...new Set((content.match(EMAIL_REGEX) ?? []))]
      .filter((e) => !e.endsWith('.png') && !e.endsWith('.jpg'))
      .slice(0, 20);

    const phones = [...new Set((content.match(PHONE_REGEX) ?? []))]
      .filter((p) => {
        const digits = p.replace(/\D/g, '').length;

        if (p.startsWith('+')) {
          return digits >= 8 && digits <= 15;
        }

        if (digits > 12) {
          return false;
        }

        return digits >= 10 && (/[-.\s()]/.test(p) || digits <= 11);
      })
      .slice(0, 10);

    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch?.[1] ?? new URL(url).hostname;

    return {
      url,
      title,
      content: content.slice(0, 5000),
      emails,
      phones,
    };
  }

  private async fetchContent(url: string): Promise<string> {
    const credentials = await this.credentialService.list();
    const firecrawl = credentials.find(
      (c) => normalizeProvider(c.provider) === 'firecrawl',
    );

    if (firecrawl) {
      try {
        return await this.fetchWithFirecrawl(firecrawl.apiKey, url);
      } catch (error) {
        this.logger.warn(
          `Firecrawl scrape failed (${error instanceof Error ? error.message : error}); falling back to Jina`,
        );
      }
    }

    return this.fetchWithJina(url);
  }

  private async fetchWithFirecrawl(apiKey: string, url: string): Promise<string> {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl scrape failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: { markdown?: string };
    };

    return data.data?.markdown ?? '';
  }

  private async fetchWithJina(url: string): Promise<string> {
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: {
        Accept: 'text/markdown',
        'X-No-Cache': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`Jina Reader failed for ${url}: ${response.status}`);
    }

    return response.text();
  }
}