import { type Os20Lead } from '@/os20-leads/types/Os20Lead';

export const sortLeadsByScore = (leads: Os20Lead[]): Os20Lead[] =>
  [...leads].sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) || a.company.localeCompare(b.company),
  );
