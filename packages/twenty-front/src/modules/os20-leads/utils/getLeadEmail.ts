import { type Os20Lead } from '@/os20-leads/types/Os20Lead';

export const getLeadEmail = (lead: Os20Lead): string | undefined =>
  lead.verifiedEmails?.[0] ?? lead.emails?.[0] ?? lead.possibleEmails?.[0];
