import { useEffect, useState } from 'react';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { type Os20UpdateStatus } from '@/os20-updates/types/Os20UpdateStatus';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const useOs20UpdateStatus = () => {
  const authFetch = useAuthenticatedFetch();
  const [status, setStatus] = useState<Os20UpdateStatus | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const response = await authFetch(
          `${REACT_APP_SERVER_BASE_URL}/os20-updates/status`,
        );
        const data = response.ok
          ? ((await response.json()) as Os20UpdateStatus)
          : null;

        if (isActive) setStatus(data);
      } catch {
        if (isActive) setStatus(null);
      } finally {
        if (isActive) setIsLoaded(true);
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [authFetch]);

  return { status, isLoaded };
};
