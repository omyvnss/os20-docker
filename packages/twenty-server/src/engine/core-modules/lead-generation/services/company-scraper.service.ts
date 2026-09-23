import { Injectable, Logger } from '@nestjs/common';

import { type ScrapedCompany } from '../interfaces/lead-generation.interface';
import {
  decodeHtmlEntities,
  extractCompanyName,
  getMetaContent,
} from '../utils/company-name.util';
import { filterLeadEmails } from '../utils/junk-email.util';
import {
  extractPhoneFromHtml,
  inferCountryCode,
} from '../utils/lead-phone.util';
import {
  getCompanyRootDomain,
  getRegistrableDomain,
} from '../utils/registrable-domain.util';
import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';

const BOT_CHALLENGE_PATTERN =
  /<title>\s*(checking your browser|just a moment|attention required|access denied|verify you are human)/i;

@Injectable()
export class CompanyScraperService {
  private readonly logger = new Logger(CompanyScraperService.name);

  constructor(
    private readonly secureHttpClientService: SecureHttpClientService,
  ) {}

  async scrapeCompany(url: string): Promise<ScrapedCompany | null> {
    const html = await this.fetchHtml(url);

    if (!html) {
      return null;
    }

    const domain = getCompanyRootDomain(new URL(url).hostname);
    const location = this.extractLocation(html);
    const country = inferCountryCode({
      country: this.extractAddressCountry(html),
      location,
      domain,
    });

    return {
      name: extractCompanyName(html, url),
      domain,
      url,
      description: this.extractDescription(html),
      industry: this.extractIndustry(html),
      size: this.extractCompanySize(html),
      location,
      emails: this.extractEmails(html).sort(
        (a, b) =>
          Number(b.endsWith(`@${domain}`)) - Number(a.endsWith(`@${domain}`)),
      ),
      phone: extractPhoneFromHtml(html, country),
      socialLinks: this.extractSocialLinks(html),
      employees: this.extractEmployees(html),
      founded: this.extractFounded(html),
    };
  }

  // Directory and "top 10" pages link out to the companies they list.
  async fetchOutboundLinks(url: string): Promise<string[]> {
    const html = await this.fetchHtml(url);

    if (!html) {
      return [];
    }

    const pageDomain = getRegistrableDomain(new URL(url).hostname);
    const links = new Set<string>();

    for (const [, href] of html.matchAll(
      /<a[^>]+href=["'](https?:\/\/[^"'#]+)["']/gi,
    )) {
      try {
        const link = new URL(decodeHtmlEntities(href));

        if (getRegistrableDomain(link.hostname) !== pageDomain) {
          links.add(link.toString());
        }
      } catch {
        continue;
      }
    }

    return [...links];
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const safeFetch = this.secureHttpClientService.createSsrfSafeFetch({
        timeout: 8_000,
        maxContentLength: 5_000_000,
      });
      const response = await safeFetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        // Axios (safe mode) enforces `timeout`; plain fetch needs the signal.
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();

      // Bot walls (Cloudflare, Akamai) return a challenge page, not the site.
      return BOT_CHALLENGE_PATTERN.test(html.slice(0, 5000)) ? null : html;
    } catch (error) {
      this.logger.warn(`Failed to fetch ${url}: ${error}`);

      return null;
    }
  }

  private extractDescription(html: string): string {
    const description =
      getMetaContent(html, 'property', 'og:description') ??
      getMetaContent(html, 'name', 'description');

    return description ? decodeHtmlEntities(description).trim() : '';
  }

  private extractIndustry(html: string): string {
    const industryKeywords = [
      'saas',
      'software',
      'fintech',
      'healthtech',
      'edtech',
      'ecommerce',
      'e-commerce',
      'marketplace',
      'agency',
      'consulting',
      'manufacturing',
      'logistics',
      'real estate',
    ];

    const lowerHtml = html.toLowerCase();

    for (const keyword of industryKeywords) {
      if (lowerHtml.includes(keyword)) {
        return keyword.charAt(0).toUpperCase() + keyword.slice(1);
      }
    }

    return '';
  }

  private extractCompanySize(html: string): string {
    const sizePatterns = [
      { pattern: /(\d+[\+]?\s*(?:employees|team members|people))/i, group: 1 },
      { pattern: /team of (\d+)/i, group: 1 },
      { pattern: /(\d+)\+?\s*(?:employees|people|team)/i, group: 1 },
    ];

    for (const { pattern, group } of sizePatterns) {
      const match = html.match(pattern);
      if (match) return match[group];
    }

    return '';
  }

  private extractLocation(html: string): string {
    const locationPatterns = [
      /(?:headquartered?|located?|based)\s+(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z]{2})?)/i,
      /(?:address|location)[:\s]+([^<\n]{5,50})/i,
    ];

    for (const pattern of locationPatterns) {
      const match = html.match(pattern);
      if (match) return match[1].trim();
    }

    return '';
  }

  private extractEmails(html: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    return filterLeadEmails(html.match(emailRegex) ?? []);
  }

  private extractAddressCountry(html: string): string {
    return (
      html.match(/"addressCountry"\s*:\s*"([^"]{2,40})"/i)?.[1] ??
      html.match(
        /"addressCountry"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]{2,40})"/i,
      )?.[1] ??
      ''
    );
  }

  private extractSocialLinks(html: string): string[] {
    const socialPatterns = [
      /https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9-]+/g,
      /https?:\/\/(?:www\.)?twitter\.com\/[a-zA-Z0-9_]+/g,
      /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/g,
      /https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9-]+/g,
    ];

    const links: string[] = [];

    for (const pattern of socialPatterns) {
      links.push(...(html.match(pattern) || []));
    }

    return [...new Set(links)];
  }

  private extractEmployees(html: string): string {
    const match = html.match(/(\d[\d,]*)\s*(?:employees|team members|people)/i);

    return match ? match[1].replace(/,/g, '') : '';
  }

  private extractFounded(html: string): string {
    const match = html.match(
      /(?:founded|established|since)\s*(?:in\s*)?(\d{4})/i,
    );

    return match ? match[1] : '';
  }
}
