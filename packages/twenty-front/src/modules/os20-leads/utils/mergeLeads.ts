import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { getLeadKey } from '@/os20-leads/utils/getLeadKey';

// Incoming leads replace existing ones with the same key, like the server merge.
export const mergeLeads = (
  existing: Os20Lead[],
  incoming: Os20Lead[],
): Os20Lead[] => {
  const byKey = new Map<string, Os20Lead>();

  for (const lead of [...existing, ...incoming]) {
    byKey.set(getLeadKey(lead), lead);
  }

  return Array.from(byKey.values());
};
