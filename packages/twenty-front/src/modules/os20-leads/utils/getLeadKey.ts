import { type Os20Lead } from '@/os20-leads/types/Os20Lead';

// Must match getLeadKey in the server's lead-persistence.service.ts.
export const getLeadKey = (lead: Os20Lead): string =>
  lead.domain || lead.companyUrl || lead.externalId || lead.id;
