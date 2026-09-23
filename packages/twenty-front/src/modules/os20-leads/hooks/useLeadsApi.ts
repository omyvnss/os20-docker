import { useCallback } from 'react';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { type Os20LeadSearchResult } from '@/os20-leads/types/Os20LeadSearchResult';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type FindLeadsInput = {
  query: string;
  location: string;
  count: number;
};

export const useLeadsApi = () => {
  const authFetch = useAuthenticatedFetch();

  const loadSavedLeads = useCallback(async (): Promise<Os20Lead[]> => {
    const response = await authFetch(
      `${REACT_APP_SERVER_BASE_URL}/lead-generation/leads`,
    );

    if (!response.ok) {
      throw new Error(`Could not load leads (${response.status})`);
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
  }, [authFetch]);

  const findLeads = useCallback(
    async ({
      query,
      location,
      count,
    }: FindLeadsInput): Promise<Os20LeadSearchResult> => {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/lead-generation/find`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            icp: {
              industry: query.trim(),
              keywords: query.trim() ? [query.trim()] : [],
              location: location.trim() || undefined,
              maxResults: count,
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : `Search failed (${response.status})`,
        );
      }

      const data = await response.json();

      return {
        leads: Array.isArray(data?.leads) ? data.leads : [],
        hints: Array.isArray(data?.hints) ? data.hints : [],
      };
    },
    [authFetch],
  );

  const removeSavedLead = useCallback(
    async (key: string): Promise<void> => {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/lead-generation/leads/${encodeURIComponent(key)}`,
        { method: 'DELETE' },
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(`Could not remove lead (${response.status})`);
      }
    },
    [authFetch],
  );

  return { loadSavedLeads, findLeads, removeSavedLead };
};
