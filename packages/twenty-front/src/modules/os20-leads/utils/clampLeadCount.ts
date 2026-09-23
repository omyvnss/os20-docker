import { LEAD_SEARCH_DEFAULT_COUNT } from '@/os20-leads/constants/LeadSearchDefaultCount';
import { LEAD_SEARCH_MAX_COUNT } from '@/os20-leads/constants/LeadSearchMaxCount';

export const clampLeadCount = (value: string | number): number => {
  const parsed = Math.round(Number(value));

  if (!Number.isFinite(parsed) || parsed < 1) {
    return LEAD_SEARCH_DEFAULT_COUNT;
  }

  return Math.min(parsed, LEAD_SEARCH_MAX_COUNT);
};
