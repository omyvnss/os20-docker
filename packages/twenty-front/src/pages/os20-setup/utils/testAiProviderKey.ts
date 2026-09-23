import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  AI_PROVIDER_TEST_MODELS,
  type KeyedAiProviderId,
} from '~/pages/os20-setup/constants/AiProviders';

type AuthenticatedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

// Returns null on success, or a short error message.
export const testAiProviderKey = async (
  authFetch: AuthenticatedFetch,
  provider: KeyedAiProviderId,
): Promise<string | null> => {
  try {
    const response = await authFetch(
      `${REACT_APP_SERVER_BASE_URL}/ai-provider/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AI_PROVIDER_TEST_MODELS[provider],
          messages: [
            { role: 'user', content: 'Reply with the single word OK.' },
          ],
          max_tokens: 16,
        }),
      },
    );

    if (response.ok) {
      return null;
    }

    return `Test failed (${response.status}). Check the key and that the account has credit.`;
  } catch {
    return "Can't reach the OS20 server.";
  }
};
