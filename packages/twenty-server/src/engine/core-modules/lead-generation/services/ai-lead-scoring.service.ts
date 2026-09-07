import { Injectable, Logger } from '@nestjs/common';

import { ProviderRegistry } from 'src/engine/core-modules/ai-provider/registry/provider.registry';

import {
  type IdealCustomerProfile,
  type Lead,
  type ScrapedCompany,
} from '../interfaces/lead-generation.interface';
import { LeadByokService, type ByokContext } from './lead-byok.service';

@Injectable()
export class AiLeadScoringService {
  private readonly logger = new Logger(AiLeadScoringService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly byok: LeadByokService,
  ) {}

  async scoreLeads(
    companies: ScrapedCompany[],
    icp: IdealCustomerProfile,
    preferredModel?: string,
  ): Promise<Lead[]> {
    const model = preferredModel || 'openai/gpt-4o-mini';

    const byok = await this.byok.resolve();

    const leads: Lead[] = [];

    for (const company of companies) {
      try {
        const score = await this.scoreCompany(company, icp, byok, model);

        leads.push({
          id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          company: company.name,
          companyUrl: company.url,
          industry: company.industry || 'Unknown',
          size: company.size || 'Unknown',
          location: company.location || 'Unknown',
          description: company.description,
          contacts: [],
          score,
          source: 'web-search',
          foundAt: new Date(),
        });
      } catch (error) {
        this.logger.warn(`Failed to score ${company.name}: ${error}`);

        leads.push({
          id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          company: company.name,
          companyUrl: company.url,
          industry: company.industry || 'Unknown',
          size: company.size || 'Unknown',
          location: company.location || 'Unknown',
          description: company.description,
          contacts: [],
          score: 50,
          source: 'web-search',
          foundAt: new Date(),
        });
      }
    }

    return leads.sort((a, b) => b.score - a.score);
  }

  private async scoreCompany(
    company: ScrapedCompany,
    icp: IdealCustomerProfile,
    byok: ByokContext | null,
    model: string,
  ): Promise<number> {
    const prompt = `Score this company as a potential lead (0-100).

Company: ${company.name}
Industry: ${company.industry}
Size: ${company.size}
Location: ${company.location}
Description: ${company.description?.substring(0, 200)}

Ideal Customer Profile:
- Industry: ${icp.industry || 'Any'}
- Size: ${icp.companySize || 'Any'}
- Location: ${icp.location || 'Any'}
- Keywords: ${icp.keywords?.join(', ') || 'None'}

Reply with ONLY a number 0-100. No explanation.`;

    try {
      const effectiveModel = byok ? byok.model : model;
      const provider = byok
        ? this.providerRegistry.resolve(byok.provider)
        : this.providerRegistry.resolve(effectiveModel);

      const response = await provider.generate(
        {
          model: effectiveModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 10,
        },
        byok?.apiKey,
      );

      const scoreStr = response.choices[0]?.message?.content?.trim() || '50';
      const score = parseInt(scoreStr.replace(/[^0-9]/g, ''), 10);

      return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
    } catch (error) {
      this.logger.warn(`AI scoring failed, using fallback: ${error}`);
      return this.fallbackScore(company, icp);
    }
  }

  private fallbackScore(company: ScrapedCompany, icp: IdealCustomerProfile): number {
    let score = 50;

    if (icp.industry && company.industry?.toLowerCase().includes(icp.industry.toLowerCase())) {
      score += 20;
    }

    if (icp.location && company.location?.toLowerCase().includes(icp.location.toLowerCase())) {
      score += 15;
    }

    if (icp.keywords?.length) {
      const text = `${company.name} ${company.description} ${company.industry}`.toLowerCase();
      const matches = icp.keywords.filter((k) => text.includes(k.toLowerCase()));
      score += matches.length * 5;
    }

    if (company.emails?.length) {
      score += 10;
    }

    return Math.min(100, score);
  }

  async generateOutreach(
    lead: Lead,
    icp: IdealCustomerProfile,
    model?: string,
  ): Promise<string> {
    const aiModel = model || 'openai/gpt-4o-mini';

    const byok = await this.byok.resolve();

    const prompt = `Write a short, personalized outreach message for this potential customer.

Company: ${lead.company}
Industry: ${lead.industry}
What they do: ${lead.description?.substring(0, 300)}

Keep it under 100 words. Professional but friendly. Don't be salesy.`;

    try {
      const effectiveModel = byok ? byok.model : aiModel;
      const provider = byok
        ? this.providerRegistry.resolve(byok.provider)
        : this.providerRegistry.resolve(effectiveModel);

      const response = await provider.generate(
        {
          model: effectiveModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 200,
        },
        byok?.apiKey,
      );

      return response.choices[0]?.message?.content || '';
    } catch {
      return `Hi ${lead.company} team,\n\nI came across your company and think there might be a great fit for collaboration.\n\nWould you be open to a quick chat?\n\nBest regards`;
    }
  }
}
