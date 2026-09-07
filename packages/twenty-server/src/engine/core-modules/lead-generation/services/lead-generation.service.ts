import { Injectable, Logger } from '@nestjs/common';

import { v4 } from 'uuid';

import {
  type IdealCustomerProfile,
  type Lead,
  type ScrapedCompany,
} from '../interfaces/lead-generation.interface';
import { WebSearchService } from './web-search.service';
import { CompanyScraperService } from './company-scraper.service';
import { AiLeadScoringService } from './ai-lead-scoring.service';
import {
  LeadEnrichmentService,
  type EnrichmentResult,
  type ExtractionResult,
} from './lead-enrichment.service';
import { LeadPersistenceService } from './lead-persistence.service';

@Injectable()
export class LeadGenerationService {
  private readonly logger = new Logger(LeadGenerationService.name);

  constructor(
    private readonly webSearch: WebSearchService,
    private readonly scraper: CompanyScraperService,
    private readonly aiScoring: AiLeadScoringService,
    private readonly enrichment: LeadEnrichmentService,
    private readonly persistence: LeadPersistenceService,
  ) {}

  async findLeads(
    icp: IdealCustomerProfile,
    model?: string,
  ): Promise<{ leads: Lead[]; searchQuery: string }> {
    const searchQuery = this.webSearch.buildSearchQuery(icp);

    this.logger.log(`Searching for leads with query: ${searchQuery}`);

    const searchResults = await this.webSearch.search(
      searchQuery,
      icp.maxResults || 20,
    );

    this.logger.log(`Found ${searchResults.length} search results`);

    const companies: ScrapedCompany[] = [];

    const scrapePromises = searchResults.slice(0, 10).map(async (result) => {
      try {
        const company = await this.scraper.scrapeCompany(result.url);
        if (company && company.name) {
          const extraction = await this.enrichment.extractCompany(
            company.domain || company.website || result.url,
          );
          if (extraction) {
            this.mergeExtraction(company, extraction);
          }
          return company;
        }
      } catch (error) {
        this.logger.warn(`Failed to scrape ${result.url}: ${error}`);
      }
      return null;
    });

    const scrapedResults = await Promise.all(scrapePromises);

    for (const company of scrapedResults) {
      if (company) {
        companies.push(company);
      }
    }

    this.logger.log(`Scraped ${companies.length} company websites`);

    const enrichmentMap = new Map<string, EnrichmentResult>();
    if (this.enrichment.enabled) {
      const results = await Promise.all(
        companies.map(async (company) => [
          company.url,
          await this.enrichment.enrichCompany(company),
        ]),
      );
      for (const [url, result] of results) {
        enrichmentMap.set(url, result);
      }
    }

    const leads = await this.aiScoring.scoreLeads(companies, icp, model);

    if (enrichmentMap.size) {
      for (const lead of leads) {
        const enrichment = enrichmentMap.get(lead.companyUrl);
        if (!enrichment) {
          continue;
        }
        lead.contacts = enrichment.verifiedEmails.map((email) => ({
          name: lead.company || lead.companyUrl,
          title: 'Prospect',
          email,
        }));
        lead.verifiedEmails = enrichment.verifiedEmails;
        lead.possibleEmails = enrichment.possibleEmails;
        lead.enrichmentScore = enrichment.score;
      }
    }

    this.logger.log(`Scored ${leads.length} leads`);

    const saved = await this.persistence.save(leads);

    this.logger.log(`Persisted ${saved.length} saved leads`);

    return { leads: saved, searchQuery };
  }

  private mergeExtraction(
    company: ScrapedCompany,
    extraction: ExtractionResult,
  ): void {
    if (!company.description && extraction.description) {
      company.description = extraction.description;
    }
    if (!company.industry && extraction.industry) {
      company.industry = extraction.industry;
    }
    if (!company.size && extraction.size) {
      company.size = extraction.size;
    }
    if (!company.location && (extraction.address || extraction.website)) {
      company.location = extraction.address || extraction.website;
    }

    const existing = new Set((company.emails || []).map((e) => e.toLowerCase()));
    for (const email of extraction.emails) {
      if (!existing.has(email.toLowerCase())) {
        existing.add(email.toLowerCase());
        company.emails = [...(company.emails || []), email];
      }
    }
  }

  async generateOutreach(
    lead: Lead,
    icp: IdealCustomerProfile,
    model?: string,
  ): Promise<string> {
    return this.aiScoring.generateOutreach(lead, icp, model);
  }

  async getSavedLeads(): Promise<Lead[]> {
    return this.persistence.list();
  }

  async generateBulkOutreach(
    leads: Lead[],
    icp: IdealCustomerProfile,
    model?: string,
  ): Promise<{ leadId: string; message: string }[]> {
    const results: { leadId: string; message: string }[] = [];

    for (const lead of leads) {
      const message = await this.generateOutreach(lead, icp, model);
      results.push({ leadId: lead.id, message });
    }

    return results;
  }
}
