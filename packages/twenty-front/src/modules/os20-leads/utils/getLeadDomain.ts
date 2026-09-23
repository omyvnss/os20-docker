import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { normalizeDomain } from '@/os20-leads/utils/normalizeDomain';

export const getLeadDomain = (lead: Os20Lead): string | undefined =>
  normalizeDomain(lead.domain) ?? normalizeDomain(lead.companyUrl);
