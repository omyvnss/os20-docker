import { useStore } from 'jotai';
import { useCallback } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { fetchLocalTokenPair } from '@/auth/utils/fetchLocalTokenPair';

export const useAuthenticatedFetch = () => {
  const store = useStore();

  return useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const send = () => {
        const token = store.get(tokenPairState.atom)
          ?.accessOrWorkspaceAgnosticToken?.token;
        const headers = new Headers(init.headers);

        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        return fetch(input, { ...init, headers });
      };

      const response = await send();

      if (response.status !== 401) {
        return response;
      }

      // The access token expired; zero-login can reissue it without the user.
      const { tokenPair } = await fetchLocalTokenPair().catch(() => ({
        tokenPair: null,
      }));

      if (!tokenPair) {
        return response;
      }

      store.set(tokenPairState.atom, tokenPair);

      return send();
    },
    [store],
  );
};
