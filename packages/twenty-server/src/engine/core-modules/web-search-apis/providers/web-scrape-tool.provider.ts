import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { ToolCategory } from 'twenty-shared/ai';

import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

import { WebScrapeToolService } from '../services/web-scrape-tool.service';

const webScrapeSchema = z.object({
  url: z.string().describe('Full URL of the web page to scrape'),
});

@Injectable()
export class WebScrapeToolProvider implements ToolProvider {
  readonly category: ToolCategory = ToolCategory.WEB_SCRAPER;

  constructor(private readonly scrapeService: WebScrapeToolService) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateDescriptors(): Promise<ToolDescriptor[]> {
    return [
      {
        name: 'web_scrape',
        label: 'Web Scrape & Extract',
        description:
          'Scrape a web page and extract its content, email addresses, and phone numbers. Use this after web_search to get detailed information from specific URLs.',
        category: this.category,
        executionRef: { kind: 'static', toolId: 'web_scrape' },
        inputSchema: webScrapeSchema,
      },
    ];
  }

  async executeStaticTool(
    _toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    const url = args.url as string | undefined;

    if (!url) {
      return {
        success: false,
        message: 'Missing required parameter: url',
        error: 'Provide a URL to scrape.',
      };
    }

    try {
      new URL(url);
    } catch {
      return {
        success: false,
        message: 'Invalid URL',
        error: `"${url}" is not a valid URL.`,
      };
    }

    try {
      const result = await this.scrapeService.scrape(url);

      return {
        success: true,
        message: `Scraped ${result.emails.length} emails and ${result.phones.length} phone numbers from ${url}`,
        result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to scrape ${url}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}