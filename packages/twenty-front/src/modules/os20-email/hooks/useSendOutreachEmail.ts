import { t } from '@lingui/core/macro';
import { useCallback, useState } from 'react';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { getApiErrorMessage } from '@/os20-contacts/utils/getApiErrorMessage';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type SendOutreachEmailInput = {
  personId: string;
  subject: string;
  body: string;
  confirm: boolean;
};

export type SendOutreachEmailResult = {
  to: string;
  sentToday: number;
  remaining: number;
};

const toNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const useSendOutreachEmail = () => {
  const authFetch = useAuthenticatedFetch();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOutreachEmail = useCallback(
    async (
      input: SendOutreachEmailInput,
    ): Promise<SendOutreachEmailResult | null> => {
      setIsSending(true);
      setError(null);

      try {
        const response = await authFetch(
          `${REACT_APP_SERVER_BASE_URL}/os20-email/send`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          },
        );
        const body = (await response.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;

        if (!response.ok) {
          setError(
            getApiErrorMessage(body) ??
              t`Could not send the email (${response.status})`,
          );

          return null;
        }

        return {
          to: typeof body?.to === 'string' ? body.to : '',
          sentToday: toNumber(body?.sentToday),
          remaining: toNumber(body?.remaining),
        };
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));

        return null;
      } finally {
        setIsSending(false);
      }
    },
    [authFetch],
  );

  const clearError = useCallback(() => setError(null), []);

  return { sendOutreachEmail, isSending, error, clearError };
};
