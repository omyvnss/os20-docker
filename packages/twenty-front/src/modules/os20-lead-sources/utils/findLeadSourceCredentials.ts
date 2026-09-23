import { type WebSearchApiCredential } from '@/os20-lead-sources/types/WebSearchApiCredential';

const normalizeProvider = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

export const findLeadSourceCredentials = (
  credentials: WebSearchApiCredential[],
  providerId: string,
): WebSearchApiCredential[] =>
  credentials.filter(
    (credential) =>
      normalizeProvider(credential.provider) === normalizeProvider(providerId),
  );
