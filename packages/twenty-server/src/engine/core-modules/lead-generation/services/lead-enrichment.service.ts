import { Injectable, Logger } from '@nestjs/common';

import { type ScrapedCompany } from '../interfaces/lead-generation.interface';
import { LeadByokService } from './lead-byok.service';

export interface VerifiedEmail {
  email: string;
  verified: boolean;
  deliverable?: boolean | null;
  detail?: string;
}

export interface ExtractionResult {
  url: string;
  status: string;
  name?: string;
  industry?: string;
  description?: string;
  website?: string;
  address?: string;
  size?: string;
  founded?: string;
  emails: string[];
  phones: string[];
  socialLinks: string[];
}

export interface EnrichmentResult {
  verifiedEmails: string[];
  possibleEmails: string[];
  score?: number;
  companyDomain?: string | null;
}

@Injectable()
export class LeadEnrichmentService {
  private readonly logger = new Logger(LeadEnrichmentService.name);

  private readonly baseUrl = process.env.OS20_LEADGEN_URL?.trim();

  constructor(private readonly byok: LeadByokService) {}

  get enabled(): boolean {
    return !!this.baseUrl;
  }

  async extractCompany(url: string): Promise<ExtractionResult | null> {
    if (!this.enabled) {
      return null;
    }

    const ctx = await this.byok.resolve();
    if (!ctx) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          provider: ctx.provider,
          apiKey: ctx.apiKey,
          model: ctx.model,
        }),
        // Internal Docker network only; the workspace key is passed to the
        // sidecar so it can run the BYOK LLM extraction.
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.status === 'ok' ? (data as ExtractionResult) : null;
    } catch (error) {
      this.logger.warn(`Extraction failed for ${url}: ${error}`);
      return null;
    }
  }

  async verifyEmails(emails: string[]): Promise<VerifiedEmail[]> {
    if (!this.enabled || !emails.length) {
      return [];
    }

    const results = await Promise.allSettled(
      emails.map(async (email) => {
        const response = await fetch(`${this.baseUrl}/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          signal: AbortSignal.timeout(12000),
        });
        const data = await response.json();
        return {
          email,
          verified: data.deliverable === true,
          deliverable: data.deliverable,
          detail: data.detail,
        } as VerifiedEmail;
      }),
    );

    return results.map((res, index) =>
      res.status === 'fulfilled'
        ? res.value
        : { email: emails[index], verified: false, detail: 'sidecar-error' },
    );
  }

  async enrichCompany(company: ScrapedCompany): Promise<EnrichmentResult> {
    const empty: EnrichmentResult = { verifiedEmails: [], possibleEmails: [] };

    if (!this.enabled || !company) {
      return empty;
    }

    try {
      const response = await fetch(`${this.baseUrl}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.name,
          website: company.url,
          bio: company.description || '',
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return empty;
      }

      const data = await response.json();

      const verifiedEmails = await this.verifyEmails(company.emails);
      const emailList = verifiedEmails
        .filter((entry) => entry.verified)
        .map((entry) => entry.email);

      if (data.emailVerified === 'verified' && data.email) {
        const best = String(data.email);
        if (!emailList.includes(best)) {
          emailList.push(best);
        }
      }

      return {
        verifiedEmails: emailList,
        possibleEmails: data.possibleEmails ?? [],
        score: typeof data.leadScore === 'number' ? data.leadScore : undefined,
        companyDomain: data.companyDomain ?? null,
      };
    } catch (error) {
      this.logger.warn(`Lead enrichment failed for ${company.name}: ${error}`);
      return empty;
    }
  }
}