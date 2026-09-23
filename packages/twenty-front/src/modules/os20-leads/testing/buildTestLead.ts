import { type Os20Lead } from '@/os20-leads/types/Os20Lead';

export const buildTestLead = (overrides: Partial<Os20Lead> = {}): Os20Lead => ({
  id: overrides.id ?? 'lead-1',
  company: 'Acme',
  companyUrl: 'https://www.acme.com/',
  domain: 'acme.com',
  score: 50,
  source: 'web_search',
  ...overrides,
});
