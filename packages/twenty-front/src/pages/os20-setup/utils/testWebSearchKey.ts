import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type WebSearchTestResult = {
  ok: boolean;
  resultCount: number;
  error?: string;
};

type AuthenticatedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const testWebSearchKey = async (
  authFetch: AuthenticatedFetch,
  provider?: string,
): Promise<WebSearchTestResult> => {
  try {
    const response = await authFetch(
      `${REACT_APP_SERVER_BASE_URL}/web-search-apis/test`,
      provider
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider }),
          }
        : { method: 'POST' },
    );

    if (!response.ok) {
      return {
        ok: false,
        resultCount: 0,
        error: `Test failed (${response.status}).`,
      };
    }

    return (await response.json()) as WebSearchTestResult;
  } catch {
    return {
      ok: false,
      resultCount: 0,
      error: "Can't reach the OS20 server.",
    };
  }
};
