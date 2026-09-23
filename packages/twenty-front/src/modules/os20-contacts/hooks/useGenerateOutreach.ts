import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useState } from 'react';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { type Os20OutreachDraft } from '@/os20-contacts/types/Os20OutreachDraft';
import { type Os20OutreachTone } from '@/os20-contacts/types/Os20OutreachTone';
import { getApiErrorMessage } from '@/os20-contacts/utils/getApiErrorMessage';
import { isMissingAiKeyError } from '@/os20-contacts/utils/isMissingAiKeyError';
import { parseOutreachDraft } from '@/os20-contacts/utils/parseOutreachDraft';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type GenerateOutreachInput = {
  personId: string;
  tone?: Os20OutreachTone;
};

export type GenerateOutreachError = {
  message: string;
  isMissingAiKey: boolean;
};

export const useGenerateOutreach = () => {
  const authFetch = useAuthenticatedFetch();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<GenerateOutreachError | null>(null);
  // A stable counter that lets stale async runs skip their state updates.
  const [requestTracker] = useState(() => ({ id: 0 }));

  useEffect(
    () => () => {
      requestTracker.id += 1;
    },
    [requestTracker],
  );

  const generateOutreach = useCallback(
    async ({
      personId,
      tone,
    }: GenerateOutreachInput): Promise<Os20OutreachDraft | null> => {
      const requestId = ++requestTracker.id;
      const isCurrentRequest = () => requestTracker.id === requestId;

      setIsGenerating(true);
      setError(null);

      try {
        const response = await authFetch(
          `${REACT_APP_SERVER_BASE_URL}/lead-generation/outreach`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tone ? { personId, tone } : { personId }),
          },
        );
        const body = await response.json().catch(() => null);
        const status = response.status;

        if (!response.ok) {
          const message = getApiErrorMessage(body);

          throw Object.assign(
            new Error(message ?? t`Could not write the email (${status})`),
            { isMissingAiKey: isMissingAiKeyError(status, message) },
          );
        }

        const draft = parseOutreachDraft(body);

        if (draft === null) {
          throw new Error(t`The AI returned an empty email.`);
        }

        return isCurrentRequest() ? draft : null;
      } catch (caught) {
        if (isCurrentRequest()) {
          setError({
            message: caught instanceof Error ? caught.message : String(caught),
            isMissingAiKey:
              (caught as { isMissingAiKey?: boolean }).isMissingAiKey === true,
          });
        }

        return null;
      } finally {
        if (isCurrentRequest()) setIsGenerating(false);
      }
    },
    [authFetch, requestTracker],
  );

  const clearError = useCallback(() => setError(null), []);

  return { generateOutreach, isGenerating, error, clearError };
};
