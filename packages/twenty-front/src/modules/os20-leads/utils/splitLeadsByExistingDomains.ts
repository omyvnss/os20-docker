import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { getLeadDomain } from '@/os20-leads/utils/getLeadDomain';
import { normalizeDomain } from '@/os20-leads/utils/normalizeDomain';

export type SplitLeadsByExistingDomains = {
  toCreate: Os20Lead[];
  duplicates: Os20Lead[];
};

// Leads whose domain is already a company, or repeats an earlier lead in the
// batch, are duplicates. Leads without a domain are deduped by name.
export const splitLeadsByExistingDomains = (
  leads: Os20Lead[],
  existingCompanyUrls: string[],
): SplitLeadsByExistingDomains => {
  const seen = new Set(
    existingCompanyUrls
      .map((url) => normalizeDomain(url))
      .filter((domain): domain is string => domain !== undefined),
  );
  const toCreate: Os20Lead[] = [];
  const duplicates: Os20Lead[] = [];

  for (const lead of leads) {
    const key =
      getLeadDomain(lead) ?? `name:${lead.company.trim().toLowerCase()}`;

    if (seen.has(key)) {
      duplicates.push(lead);
      continue;
    }

    seen.add(key);
    toCreate.push(lead);
  }

  return { toCreate, duplicates };
};
