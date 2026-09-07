import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { ToolCategory } from 'twenty-shared/ai';

import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

import { WebSearchToolService } from '../services/web-search-tool.service';
import { WebContactFinderService } from '../services/web-contact-finder.service';

const webSearchSchema = z.object({
  query: z.string().describe('Search query, e.g. "coffee shops in Mumbai"'),
  maxResults: z
    .number()
    .int()
    .positive()
    .max(20)
    .optional()
    .describe('Maximum number of results to return (default 10)'),
});

const findContactSchema = z.object({
  name: z
    .string()
    .describe(
      'Full name of the person to find contact details for, e.g. "Kunal Shah"',
    ),
  company: z
    .string()
    .optional()
    .describe('Company name the person works at / founded, e.g. "CRED"'),
  role: z
    .string()
    .optional()
    .describe('Role / title, e.g. "founder", "CEO", "CTO"'),
  domain: z
    .string()
    .optional()
    .describe('Known company website domain, e.g. "cred.club"'),
});

@Injectable()
export class WebSearchToolProvider implements ToolProvider {
  readonly category: ToolCategory = ToolCategory.WEB_SEARCH;

  constructor(
    private readonly searchService: WebSearchToolService,
    private readonly contactFinderService: WebContactFinderService,
  ) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateDescriptors(): Promise<ToolDescriptor[]> {
    return [
      {
        name: 'web_search',
        label: 'Web Search',
        description:
          'Search the web using configured API keys (Firecrawl, Tavily, Brave, SerpAPI). Returns relevant web pages with titles, URLs, and snippets. Use this for general web search.',
        category: this.category,
        executionRef: { kind: 'static', toolId: 'web_search' },
        inputSchema: webSearchSchema,
      },
      {
        name: 'find_contact',
        label: 'Find Contact Info (Emails & Phones)',
        description:
          'Find email addresses and phone numbers for a specific person or company on the internet. Runs a full pipeline: searches multiple query variants, scrapes the top candidate pages, extracts emails and phone numbers, and generates likely company-domain emails (e.g. firstname@company.com). Returns structured results with sources. Use this whenever the user asks for emails, phone numbers, or contact details of a founder, CEO, or company.',
        category: this.category,
        executionRef: { kind: 'static', toolId: 'find_contact' },
        inputSchema: findContactSchema,
      },
    ];
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    if (toolName === 'find_contact') {
      return this.executeFindContact(args);
    }

    return this.executeWebSearch(args);
  }

  private async executeFindContact(
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    const name = args.name as string | undefined;

    if (!name) {
      return {
        success: false,
        message: 'Missing required parameter: name',
        error: 'Provide the person\'s name to search for.',
      };
    }

    try {
      const result = await this.contactFinderService.find({
        name,
        company: (args.company as string | undefined) ?? undefined,
        role: (args.role as string | undefined) ?? undefined,
        domain: (args.domain as string | undefined) ?? undefined,
      });

      if (result.emails.length === 0 && result.phones.length === 0) {
        return {
          success: true,
          message:
            'No emails or phones found for this person yet. Try again with their company name, or try web_search with different queries.',
          result,
        };
      }

      return {
        success: true,
        message: `Found ${result.emails.length} email(s) and ${result.phones.length} phone number(s) for ${name}${result.company ? ` (${result.company})` : ''}`,
        result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Contact lookup failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeWebSearch(
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    const query = args.query as string | undefined;

    if (!query) {
      return {
        success: false,
        message: 'Missing required parameter: query',
        error: 'Provide a search query string.',
      };
    }

    const maxResults = (args.maxResults as number) || 10;

    try {
      const results = await this.searchService.search(query, maxResults);

      if (results.length === 0) {
        return {
          success: true,
          message:
            'No results found. If you have not configured a web search API key yet, go to Settings → Web Search APIs and add one (e.g. firecrawl, tavily).',
          result: { results: [] },
        };
      }

      return {
        success: true,
        message: `Found ${results.length} web results for "${query}"`,
        result: { results },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Web search failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}