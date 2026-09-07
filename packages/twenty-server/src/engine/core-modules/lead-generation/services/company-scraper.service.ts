import { Injectable, Logger } from '@nestjs/common';

import { type ScrapedCompany } from '../interfaces/lead-generation.interface';

@Injectable()
export class CompanyScraperService {
  private readonly logger = new Logger(CompanyScraperService.name);

  async scrapeCompany(url: string): Promise<ScrapedCompany | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      const html = await response.text();

      return {
        name: this.extractName(html, url),
        url,
        description: this.extractDescription(html),
        industry: this.extractIndustry(html),
        size: this.extractCompanySize(html),
        location: this.extractLocation(html),
        emails: this.extractEmails(html),
        phone: this.extractPhone(html),
        socialLinks: this.extractSocialLinks(html),
        employees: this.extractEmployees(html),
        founded: this.extractFounded(html),
      };
    } catch (error) {
      this.logger.warn(`Failed to scrape ${url}: ${error}`);
      return null;
    }
  }

  private extractName(html: string, url: string): string {
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogTitle) return ogTitle[1].trim();

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) return titleTag[1].trim().split('|')[0].trim().split('-')[0].trim();

    try {
      return new URL(url).hostname.replace('www.', '').split('.')[0];
    } catch {
      return url;
    }
  }

  private extractDescription(html: string): string {
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
    if (ogDesc) return ogDesc[1].trim();

    const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    if (metaDesc) return metaDesc[1].trim();

    return '';
  }

  private extractIndustry(html: string): string {
    const industryKeywords = [
      'saas', 'software', 'fintech', 'healthtech', 'edtech',
      'ecommerce', 'e-commerce', 'marketplace', 'agency',
      'consulting', 'manufacturing', 'logistics', 'real estate',
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
    const emails = html.match(emailRegex) || [];

    return [...new Set(emails)].filter(
      (email) =>
        !email.includes('example.com') &&
        !email.includes('sentry.io') &&
        !email.includes('wixpress.com') &&
        !email.endsWith('.png') &&
        !email.endsWith('.jpg'),
    );
  }

  private extractPhone(html: string): string {
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    const phones = html.match(phoneRegex) || [];

    return phones.find((p) => p.replace(/\D/g, '').length >= 7) || '';
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
      const matches = html.match(pattern) || [];
      links.push(...matches);
    }

    return [...new Set(links)];
  }

  private extractEmployees(html: string): string {
    const match = html.match(/(\d[\d,]*)\s*(?:employees|team members|people)/i);
    return match ? match[1].replace(/,/g, '') : '';
  }

  private extractFounded(html: string): string {
    const match = html.match(/(?:founded|established|since)\s*(?:in\s*)?(\d{4})/i);
    return match ? match[1] : '';
  }
}
