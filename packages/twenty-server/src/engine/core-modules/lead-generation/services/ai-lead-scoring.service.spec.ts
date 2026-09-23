import { type ScrapedCompany } from 'src/engine/core-modules/lead-generation/interfaces/lead-generation.interface';
import { AiLeadScoringService } from 'src/engine/core-modules/lead-generation/services/ai-lead-scoring.service';
import { type LeadByokService } from 'src/engine/core-modules/lead-generation/services/lead-byok.service';
import { type ProviderRegistry } from 'src/engine/core-modules/ai-provider/registry/provider.registry';

const company = (overrides: Partial<ScrapedCompany>): ScrapedCompany => ({
  name: 'Acme',
  domain: 'acme.com',
  url: 'https://acme.com/',
  description: 'SaaS billing for startups',
  industry: 'Saas',
  size: '',
  location: 'Berlin, Germany',
  emails: ['example@gmail.com', 'info@acme.com'],
  phone: '20260410',
  socialLinks: [],
  employees: '',
  founded: '',
  source: 'web_search',
  ...overrides,
});

const serviceReturning = (content: string | null) => {
  const generate = jest.fn(async () => ({
    model: 'test-model',
    choices: [{ message: { content }, finish_reason: 'stop' }],
  }));
  const providerRegistry = { resolve: () => ({ generate }) };
  const byok = {
    resolve: async () =>
      content === null
        ? null
        : { provider: 'openai', model: 'gpt', apiKey: 'key' },
  };

  return new AiLeadScoringService(
    providerRegistry as unknown as ProviderRegistry,
    byok as unknown as LeadByokService,
  );
};

describe('AiLeadScoringService reasons', () => {
  const icp = { keywords: ['saas'], location: 'Berlin' };

  it('keeps the AI reason when there is one', async () => {
    const { leads } = await serviceReturning(
      '[{"i":0,"score":82,"reason":"SaaS billing startup in Berlin"}]',
    ).scoreBatch([company({})], icp);

    expect(leads[0].reason).toBe('SaaS billing startup in Berlin');
  });

  it.each([
    '[{"i":0,"score":82}]',
    '[{"i":0,"score":82,"reason":""}]',
    '[{"i":0,"score":82,"reason":"   "}]',
  ])('builds a factual reason when the AI returns none (%s)', async (json) => {
    const { leads, aiScored } = await serviceReturning(json).scoreBatch(
      [company({})],
      icp,
    );

    expect(aiScored).toBe(true);
    expect(leads[0].reason).toBe(
      'Matches saas; based in Berlin; found via web search',
    );
  });

  it('gives heuristic-scored leads a reason too', async () => {
    const { leads, aiScored } = await serviceReturning(null).scoreBatch(
      [
        company({
          source: 'google_places',
          description: '',
          industry: 'Dentist',
        }),
      ],
      {},
    );

    expect(aiScored).toBe(false);
    expect(leads[0].reason).toBe(
      'Dentist business; located in Berlin, Germany; listed on Google Maps',
    );
  });

  it('drops junk phones and emails when building the lead', async () => {
    const { leads } = await serviceReturning(null).scoreBatch(
      [company({})],
      icp,
    );

    expect(leads[0].phone).toBeUndefined();
    expect(leads[0].emails).toEqual(['info@acme.com']);
  });
});
