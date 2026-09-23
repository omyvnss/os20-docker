import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useState } from 'react';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { getApiErrorMessage } from '@/os20-contacts/utils/getApiErrorMessage';
import { type Os20EmailSenderStatus } from '@/os20-email/types/Os20EmailSenderStatus';
import { type Os20SmtpPayload } from '@/os20-email/utils/buildOs20SmtpPayload';
import { parseOs20EmailSenderStatus } from '@/os20-email/utils/parseOs20EmailSenderStatus';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const SMTP_URL = `${REACT_APP_SERVER_BASE_URL}/os20-email/smtp`;

export type Os20EmailActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export const useOs20EmailSender = () => {
  const authFetch = useAuthenticatedFetch();
  const [status, setStatus] = useState<Os20EmailSenderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const request = useCallback(
    async (url: string, init?: RequestInit) => {
      const response = await authFetch(url, init);
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(body) ?? t`Request failed (${response.status})`,
        );
      }

      return body;
    },
    [authFetch],
  );

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(parseOs20EmailSenderStatus(await request(SMTP_URL)));
    } catch {
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<Os20EmailActionResult> => {
      try {
        const nextStatus = parseOs20EmailSenderStatus(await action());

        if (nextStatus !== null) setStatus(nextStatus);

        return { ok: true };
      } catch (caught) {
        return {
          ok: false,
          error: caught instanceof Error ? caught.message : String(caught),
        };
      }
    },
    [],
  );

  const save = useCallback(
    (payload: Os20SmtpPayload) =>
      run(() =>
        request(SMTP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ),
    [request, run],
  );

  const remove = useCallback(
    () => run(() => request(SMTP_URL, { method: 'DELETE' })),
    [request, run],
  );

  const sendTest = useCallback(async (): Promise<Os20EmailActionResult> => {
    try {
      const body = (await request(`${SMTP_URL}/test`, {
        method: 'POST',
      })) as { to?: unknown } | null;
      const to = typeof body?.to === 'string' ? body.to : '';

      return { ok: true, message: t`Test email sent to ${to}.` };
    } catch (caught) {
      return {
        ok: false,
        error: caught instanceof Error ? caught.message : String(caught),
      };
    }
  }, [request]);

  const applyQuota = useCallback(
    (sentToday: number, remaining: number) =>
      setStatus((previous) =>
        previous === null ? previous : { ...previous, sentToday, remaining },
      ),
    [],
  );

  return {
    status,
    isLoading,
    reload,
    save,
    remove,
    sendTest,
    applyQuota,
  };
};
