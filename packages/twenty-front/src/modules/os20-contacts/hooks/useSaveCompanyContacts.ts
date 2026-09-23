import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useState } from 'react';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { OS20_MAX_FIND_CONTACTS_COMPANIES } from '@/os20-contacts/constants/Os20MaxFindContactsCompanies';
import { type Os20CompanyContactsResult } from '@/os20-contacts/types/Os20CompanyContactsResult';
import { getApiErrorMessage } from '@/os20-contacts/utils/getApiErrorMessage';
import { parseCompanyContactsResults } from '@/os20-contacts/utils/parseCompanyContactsResults';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type SaveCompanyContactsStatus = 'idle' | 'saving' | 'done' | 'error';

export type SaveCompanyContactsState = {
  status: SaveCompanyContactsStatus;
  total: number;
  completed: number;
  results: Os20CompanyContactsResult[];
  error: string | null;
};

const INITIAL_STATE: SaveCompanyContactsState = {
  status: 'idle',
  total: 0,
  completed: 0,
  results: [],
  error: null,
};

class SaveContactsRequestError extends Error {
  constructor(
    message: string,
    readonly isFatal: boolean,
  ) {
    super(message);
  }
}

// Companies are sent one per request so the progress reflects real work and a
// failing company does not hide the contacts found for the others.
export const useSaveCompanyContacts = () => {
  const authFetch = useAuthenticatedFetch();
  const [state, setState] = useState<SaveCompanyContactsState>(INITIAL_STATE);
  // A stable counter that lets stale async runs skip their state updates.
  const [runTracker] = useState(() => ({ id: 0 }));

  useEffect(
    () => () => {
      runTracker.id += 1;
    },
    [runTracker],
  );

  const saveOneCompany = useCallback(
    async (companyId: string): Promise<Os20CompanyContactsResult[]> => {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/lead-generation/contacts/save`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyIds: [companyId] }),
        },
      );
      const body = await response.json().catch(() => null);
      const status = response.status;

      if (!response.ok) {
        throw new SaveContactsRequestError(
          getApiErrorMessage(body) ?? t`Could not find contacts (${status})`,
          response.status !== 400,
        );
      }

      return parseCompanyContactsResults(body);
    },
    [authFetch],
  );

  const saveCompanyContacts = useCallback(
    async (companyIds: string[]): Promise<Os20CompanyContactsResult[]> => {
      const runId = ++runTracker.id;
      const ids = Array.from(new Set(companyIds)).slice(
        0,
        OS20_MAX_FIND_CONTACTS_COMPANIES,
      );
      const results: Os20CompanyContactsResult[] = [];
      const isCurrentRun = () => runTracker.id === runId;

      setState({ ...INITIAL_STATE, status: 'saving', total: ids.length });

      for (const companyId of ids) {
        try {
          const companyResults = await saveOneCompany(companyId);

          results.push(
            ...(companyResults.length > 0
              ? companyResults
              : [
                  {
                    companyId,
                    companyName: '',
                    created: 0,
                    skipped: 0,
                    people: [],
                  },
                ]),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const isFatal =
            !(error instanceof SaveContactsRequestError) || error.isFatal;

          if (isFatal) {
            if (isCurrentRun()) {
              setState((current) => ({
                ...current,
                status: 'error',
                results: [...results],
                error: message,
              }));
            }

            return results;
          }

          results.push({
            companyId,
            companyName: '',
            created: 0,
            skipped: 0,
            people: [],
            error: message,
          });
        }

        if (!isCurrentRun()) return results;

        setState((current) => ({
          ...current,
          completed: current.completed + 1,
          results: [...results],
        }));
      }

      if (isCurrentRun()) {
        setState((current) => ({ ...current, status: 'done' }));
      }

      return results;
    },
    [runTracker, saveOneCompany],
  );

  const reset = useCallback(() => {
    runTracker.id += 1;
    setState(INITIAL_STATE);
  }, [runTracker]);

  return { ...state, saveCompanyContacts, reset };
};
