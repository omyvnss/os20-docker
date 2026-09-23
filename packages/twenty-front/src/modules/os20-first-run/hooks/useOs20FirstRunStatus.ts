import { useCallback, useEffect, useState } from 'react';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { findLeadSourceCredentials } from '@/os20-lead-sources/utils/findLeadSourceCredentials';
import { hasWebSearchCredential } from '@/os20-lead-sources/utils/hasWebSearchCredential';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type Os20FirstRunStatus = {
  isLoaded: boolean;
  hasAiKey: boolean;
  hasSearchKey: boolean;
  hasPlacesKey: boolean;
  hasRunLeadSearch: boolean;
};

const INITIAL_STATUS: Os20FirstRunStatus = {
  isLoaded: false,
  hasAiKey: false,
  hasSearchKey: false,
  hasPlacesKey: false,
  hasRunLeadSearch: false,
};

export const useOs20FirstRunStatus = () => {
  const authFetch = useAuthenticatedFetch();
  const [status, setStatus] = useState<Os20FirstRunStatus>(INITIAL_STATUS);

  const readArray = useCallback(
    async (path: string): Promise<unknown[] | null> => {
      try {
        const response = await authFetch(`${REACT_APP_SERVER_BASE_URL}${path}`);

        if (!response.ok) return null;

        const data = await response.json();

        return Array.isArray(data) ? data : null;
      } catch {
        return null;
      }
    },
    [authFetch],
  );

  const refresh = useCallback(async () => {
    const [aiKeys, searchKeys, leads] = await Promise.all([
      readArray('/ai-provider/keys'),
      readArray('/web-search-apis'),
      readArray('/lead-generation/leads'),
    ]);

    // An unreachable endpoint must not nag: treat unknown as done.
    setStatus({
      isLoaded: true,
      hasAiKey:
        aiKeys === null ||
        aiKeys.some((key) => (key as { hasKey?: boolean }).hasKey === true),
      hasSearchKey:
        searchKeys === null ||
        hasWebSearchCredential(
          searchKeys as Parameters<typeof hasWebSearchCredential>[0],
        ),
      hasPlacesKey:
        searchKeys !== null &&
        findLeadSourceCredentials(
          searchKeys as Parameters<typeof findLeadSourceCredentials>[0],
          'google_places',
        ).length > 0,
      hasRunLeadSearch: leads === null || leads.length > 0,
    });
  }, [readArray]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh };
};
