import { LEAD_SOURCE_PROVIDERS } from '@/os20-lead-sources/constants/LeadSourceProviders';
import { type WebSearchApiCredential } from '@/os20-lead-sources/types/WebSearchApiCredential';
import { findLeadSourceCredentials } from '@/os20-lead-sources/utils/findLeadSourceCredentials';

export const hasWebSearchCredential = (credentials: WebSearchApiCredential[]) =>
  LEAD_SOURCE_PROVIDERS.some(
    (provider) =>
      provider.isWebSearch &&
      findLeadSourceCredentials(credentials, provider.id).length > 0,
  );
