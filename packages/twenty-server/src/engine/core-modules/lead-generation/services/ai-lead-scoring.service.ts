import { Injectable, Logger } from '@nestjs/common';

import { v4 } from 'uuid';

import { ProviderRegistry } from 'src/engine/core-modules/ai-provider/registry/provider.registry';

import {
  type IdealCustomerProfile,
  type Lead,
  type ScrapedCompany,
} from '../interfaces/lead-generation.interface';
import { LeadByokService, type ByokContext } from './lead-byok.service';
import {
  buildOutreachPrompt,
  type OutreachContext,
  type OutreachDraft,
  type OutreachTone,
  parseOutreachResponse,
} from '../utils/outreach-prompt.util';
import { filterLeadEmails } from '../utils/junk-email.util';
import { buildLeadReason } from '../utils/lead-quality.util';
import { inferCountryCode, normalizeLeadPhone } from '../utils/lead-phone.util';

export class OutreachAiUnavailableError extends Error {
  constructor() {
    super('No AI key saved. Add one in Settings > AI Providers.');
  }
}

const OUTREACH_TIMEOUT_MS = 90_000;

// Places without a website are still leads, just weaker ones.
export const NO_WEBSITE_SCORE_PENALTY = 20;

@Injectable()
export class AiLeadScoringService {
  private readonly logger = new Logger(AiLeadScoringService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly byok: LeadByokService,
  ) {}

  // One LLM call scores every candidate; per-company calls were the slowest
  // part of the pipeline. Falls back to a heuristic score on any failure.
  async scoreBatch(
    companies: ScrapedCompany[],
    icp: IdealCustomerProfile,
  ): Promise<{ leads: Lead[]; aiScored: boolean }> {
    const leads = companies.map((company) => this.toLead(company, icp));
    const byok = companies.length > 0 ? await this.byok.resolve() : null;
    const scoredIndexes = new Set<number>();

    if (byok) {
      try {
        const scores = await this.requestScores(companies, icp, byok);

        for (const { i, score, reason } of scores) {
          const index = Number(i);

          if (leads[index] && Number.isFinite(Number(score))) {
            leads[index].score = Math.min(
              100,
              Math.max(0, Math.round(Number(score))),
            );
            leads[index].reason =
              typeof reason === 'string' && reason.trim()
                ? reason.trim()
                : leads[index].reason;
            scoredIndexes.add(index);
          }
        }
      } catch (error) {
        this.logger.warn(`AI scoring failed, using heuristic scores: ${error}`);
      }
    }

    leads.forEach((lead) => {
      if (!lead.companyUrl) {
        lead.score = Math.max(0, lead.score - NO_WEBSITE_SCORE_PENALTY);
      }
    });

    const aiScored = scoredIndexes.size > 0;
    // Leads the model skipped keep inflated heuristic scores; drop them.
    const rankedLeads = aiScored
      ? leads.filter((_, index) => scoredIndexes.has(index))
      : leads;

    return { leads: rankedLeads.sort((a, b) => b.score - a.score), aiScored };
  }

  private async requestScores(
    companies: ScrapedCompany[],
    icp: IdealCustomerProfile,
    byok: ByokContext,
  ): Promise<
    { i: number | string; score: number | string; reason?: string }[]
  > {
    const profile = [
      icp.keywords?.length ? `looking for: ${icp.keywords.join(', ')}` : '',
      icp.industry ? `industry: ${icp.industry}` : '',
      icp.location ? `location: ${icp.location}` : '',
      icp.companySize ? `size: ${icp.companySize}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    const list = companies
      .map(
        (company, i) =>
          `${i}. ${company.name} (${company.domain ?? (company.url || 'no website')}) - ${(company.description || 'no description').slice(0, 200)}${company.location ? ` - ${company.location}` : ''}`,
      )
      .join('\n');

    const response = await Promise.race([
      this.providerRegistry.resolve(byok.provider).generate(
        {
          model: byok.model,
          messages: [
            {
              role: 'user',
              content: `Score each company 0-100 as a sales lead for this ideal customer (${profile || 'any company'}). Only a single company's own website counts. Directories, job boards, events, conferences, summits, communities, media, blogs, and articles are not companies: score them below 10.\nReturn ONLY a JSON array like [{"i":0,"score":80,"reason":"under 12 words"}].\n\n${list}`,
            },
          ],
          temperature: 0,
          // Reasoning models spend output tokens before the JSON answer.
          max_tokens: Math.min(
            8000,
            Math.max(4000, 150 * companies.length + 1500),
          ),
        },
        byok.apiKey,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('scoring timed out')), 75_000),
      ),
    ]);

    const choice = response.choices[0];
    const content = choice?.message?.content ?? '';
    const json = content.match(/\[[\s\S]*\]/)?.[0];

    if (!json) {
      this.logger.warn(
        `AI scoring returned no JSON (model ${response.model}, finish ${choice?.finish_reason ?? 'unknown'}, ${content.length} chars)`,
      );

      return [];
    }

    return JSON.parse(json);
  }

  private toLead(company: ScrapedCompany, icp: IdealCustomerProfile): Lead {
    const country =
      inferCountryCode({
        location: company.location,
        domain: company.domain,
      }) ?? inferCountryCode({ location: icp.location });
    const phone = normalizeLeadPhone(company.phone, country, {
      trusted: company.source === 'google_places',
    });

    return {
      id: v4(),
      company: company.name,
      companyUrl: company.url,
      domain: company.domain,
      industry: company.industry || 'Unknown',
      size: company.size || 'Unknown',
      location: company.location || 'Unknown',
      description: company.description,
      contacts: [],
      emails: filterLeadEmails(company.emails).slice(0, 5),
      phone,
      reason: buildLeadReason(company, icp),
      score: this.fallbackScore(company, icp),
      source: company.source ?? 'web_search',
      externalId: company.externalId,
      rating: company.rating,
      reviewCount: company.reviewCount,
      foundAt: new Date(),
    };
  }

  private fallbackScore(
    company: ScrapedCompany,
    icp: IdealCustomerProfile,
  ): number {
    let score = 50;

    if (
      icp.industry &&
      company.industry?.toLowerCase().includes(icp.industry.toLowerCase())
    ) {
      score += 20;
    }

    if (
      icp.location &&
      company.location?.toLowerCase().includes(icp.location.toLowerCase())
    ) {
      score += 15;
    }

    if (icp.keywords?.length) {
      const text =
        `${company.name} ${company.description} ${company.industry}`.toLowerCase();
      const matches = icp.keywords.filter((k) =>
        text.includes(k.toLowerCase()),
      );
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
          max_tokens: 1500,
        },
        byok?.apiKey,
      );

      return response.choices[0]?.message?.content || '';
    } catch {
      return `Hi ${lead.company} team,\n\nI came across your company and think there might be a great fit for collaboration.\n\nWould you be open to a quick chat?\n\nBest regards`;
    }
  }

  async generatePersonOutreach(
    workspaceId: string,
    context: OutreachContext,
    tone: OutreachTone = 'friendly',
  ): Promise<OutreachDraft> {
    const byok = await this.byok.resolve(workspaceId);

    if (!byok) {
      throw new OutreachAiUnavailableError();
    }

    const response = await Promise.race([
      this.providerRegistry.resolve(byok.provider).generate(
        {
          model: byok.model,
          messages: [
            { role: 'user', content: buildOutreachPrompt(context, tone) },
          ],
          temperature: 0.4,
          // Reasoning models spend output tokens before the JSON answer.
          max_tokens: 3000,
        },
        byok.apiKey,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Outreach generation timed out')),
          OUTREACH_TIMEOUT_MS,
        ),
      ),
    ]);

    const draft = parseOutreachResponse(response.choices[0]?.message?.content);

    if (!draft) {
      throw new Error('The AI model returned no usable email draft');
    }

    return draft;
  }
}
