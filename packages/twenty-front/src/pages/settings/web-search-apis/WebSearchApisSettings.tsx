import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { LeadSourceProviderCard } from '@/os20-lead-sources/components/LeadSourceProviderCard';
import { LEAD_SOURCE_PROVIDERS } from '@/os20-lead-sources/constants/LeadSourceProviders';
import { type WebSearchApiCredential } from '@/os20-lead-sources/types/WebSearchApiCredential';
import { findLeadSourceCredentials } from '@/os20-lead-sources/utils/findLeadSourceCredentials';
import { hasWebSearchCredential } from '@/os20-lead-sources/utils/hasWebSearchCredential';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  testWebSearchKey,
  type WebSearchTestResult,
} from '~/pages/os20-setup/utils/testWebSearchKey';

const StyledCards = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledTestRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledTestResult = styled.span<{ isOk: boolean }>`
  color: ${({ isOk }) =>
    isOk ? themeCssVariables.color.green : themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
`;

type ProviderState = 'idle' | 'saving' | 'error';

export const WebSearchApisSettings = () => {
  const { t } = useLingui();
  const authFetch = useAuthenticatedFetch();

  const [credentials, setCredentials] = useState<WebSearchApiCredential[]>([]);
  const [providerStates, setProviderStates] = useState<
    Record<string, ProviderState>
  >({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebSearchTestResult | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/web-search-apis`,
      );
      const data = response.ok ? await response.json() : [];

      setCredentials(Array.isArray(data) ? data : []);
    } catch {
      setCredentials([]);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const setProviderState = (providerId: string, state: ProviderState) =>
    setProviderStates((previous) => ({ ...previous, [providerId]: state }));

  const deleteCredentials = async (ids: string[]) => {
    for (const id of ids) {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/web-search-apis/${id}`,
        { method: 'DELETE' },
      );

      if (!response.ok) throw new Error('delete failed');
    }
  };

  const handleSave = async (providerId: string, apiKey: string) => {
    const previousIds = findLeadSourceCredentials(credentials, providerId).map(
      (credential) => credential.id,
    );

    setProviderState(providerId, 'saving');
    try {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/web-search-apis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: providerId, apiKey }),
        },
      );

      if (!response.ok) throw new Error('save failed');

      await deleteCredentials(previousIds);
      setProviderState(providerId, 'idle');
      setTestResult(null);

      return true;
    } catch {
      setProviderState(providerId, 'error');

      return false;
    } finally {
      await load();
    }
  };

  const handleDelete = async (providerId: string) => {
    setProviderState(providerId, 'saving');
    try {
      await deleteCredentials(
        findLeadSourceCredentials(credentials, providerId).map(
          (credential) => credential.id,
        ),
      );
      setProviderState(providerId, 'idle');
      setTestResult(null);
    } catch {
      setProviderState(providerId, 'error');
    } finally {
      await load();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(await testWebSearchKey(authFetch));
    setTesting(false);
  };

  const renderCard = (providerId: string) => {
    const provider = LEAD_SOURCE_PROVIDERS.find(
      (option) => option.id === providerId,
    );

    if (!provider) return null;

    const saved = findLeadSourceCredentials(credentials, provider.id);
    const state = providerStates[provider.id] ?? 'idle';

    return (
      <LeadSourceProviderCard
        key={provider.id}
        provider={provider}
        maskedKey={saved[saved.length - 1]?.apiKey}
        isSaving={state === 'saving'}
        hasError={state === 'error'}
        onSave={(apiKey) => handleSave(provider.id, apiKey)}
        onDelete={() => handleDelete(provider.id)}
        onTest={
          provider.isWebSearch
            ? undefined
            : () => testWebSearchKey(authFetch, provider.id)
        }
      />
    );
  };

  return (
    <SettingsPageLayout
      title={t`Lead Sources`}
      links={[
        { children: t`Workspace`, href: getSettingsPath(SettingsPath.General) },
        { children: t`Lead Sources` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Local businesses`}
            description={t`Keys are encrypted in your workspace and never shown again after saving.`}
          />
          <StyledCards>
            {LEAD_SOURCE_PROVIDERS.filter(
              (provider) => !provider.isWebSearch,
            ).map((provider) => renderCard(provider.id))}
          </StyledCards>
        </Section>

        <Section>
          <H2Title
            title={t`Web search`}
            description={t`Used by the AI to find companies on the web. One key is enough.`}
          />
          <StyledCards>
            {LEAD_SOURCE_PROVIDERS.filter(
              (provider) => provider.isWebSearch,
            ).map((provider) => renderCard(provider.id))}
          </StyledCards>

          {hasWebSearchCredential(credentials) && (
            <StyledTestRow>
              <Button
                onClick={handleTest}
                disabled={testing}
                variant="secondary"
                title={testing ? t`Testing…` : t`Test web search`}
              />
              {testResult && (
                <StyledTestResult role="status" isOk={testResult.ok}>
                  {testResult.ok
                    ? t`Search works.`
                    : (testResult.error ?? t`Test failed.`)}
                </StyledTestResult>
              )}
            </StyledTestRow>
          )}
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
