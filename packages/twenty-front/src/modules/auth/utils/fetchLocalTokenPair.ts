import { type AuthTokenPair } from '~/generated-metadata/graphql';

type LocalTokenResponse = {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

// Zero-login: the server issues a session for the local workspace. Throws on
// network errors so callers can tell "server down" from a rejected request.
export const fetchLocalTokenPair = async (): Promise<{
  status: number;
  tokenPair: AuthTokenPair | null;
}> => {
  const response = await fetch('/auth/local-token', {
    headers: { Accept: 'application/json', 'X-OS20-Local': '1' },
  });

  if (!response.ok) {
    return { status: response.status, tokenPair: null };
  }

  const data = (await response.json()) as LocalTokenResponse;

  return {
    status: response.status,
    tokenPair: {
      accessOrWorkspaceAgnosticToken: {
        token: data.token,
        expiresAt: data.expiresAt,
      },
      refreshToken: {
        token: data.refreshToken,
        expiresAt: data.refreshTokenExpiresAt,
      },
    },
  };
};
