import { type Os20Lead } from '@/os20-leads/types/Os20Lead';

export type Os20LeadSearchResult = {
  leads: Os20Lead[];
  hints: string[];
};
