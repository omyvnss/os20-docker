import { useCallback, useEffect, useState } from 'react';
import { useLingui } from '@lingui/react/macro';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { H2Title, H3Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';
import { Button } from 'twenty-ui/input';
import { IconCheck, IconAlertTriangle, IconInfoCircle } from 'twenty-ui/icon';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useClientConfig } from '@/client-config/hooks/useClientConfig';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  AI_PROVIDER_TEST_MODELS,
  type KeyedAiProviderId,
} from '~/pages/os20-setup/constants/AiProviders';

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, o3, o3-mini, o4-mini',
    envKey: 'OPENAI_API_KEY',
    color: '#10a37f',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet 4, Claude Opus 4, Claude 3.5 Haiku',
    envKey: 'ANTHROPIC_API_KEY',
    color: '#d4a574',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash',
    envKey: 'GOOGLE_API_KEY',
    color: '#4285f4',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '100+ models from all providers',
    envKey: 'OPENROUTER_API_KEY',
    color: '#6366f1',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Llama 3.3 70B, Mixtral 8x7B, fast inference',
    envKey: 'GROQ_API_KEY',
    color: '#f55036',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Any locally installed model, auto-detected',
    envKey: 'OLLAMA_BASE_URL',
    color: '#fff',
    isLocal: true,
  },
];

type ProviderKeyStatus = {
  provider: string;
  hasKey: boolean;
};

type SaveState = {
  [providerId: string]: 'idle' | 'saving' | 'saved' | 'error';
};

type TestState = {
  [providerId: string]: 'idle' | 'testing' | 'success' | 'error';
};

export const SettingsAIProviders = () => {
  const { t } = useLingui();
  const authFetch = useAuthenticatedFetch();
  const { refetch: refetchClientConfig } = useClientConfig();
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const workspaceId = currentWorkspace?.id;

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<SaveState>({});
  const [testStates, setTestStates] = useState<TestState>({});
  const [statuses, setStatuses] = useState<ProviderKeyStatus[]>([]);

  const loadStatuses = useCallback(async () => {
    try {
      const res = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/keys`,
      );
      const data = res.ok ? await res.json() : [];

      setStatuses(Array.isArray(data) ? data : []);
    } catch {
      setStatuses([]);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!workspaceId) return;

    loadStatuses();
  }, [workspaceId, loadStatuses]);

  const getConfigured = (providerId: string) =>
    statuses.find((s) => s.provider === providerId)?.hasKey ?? false;

  const handleSave = async (providerId: string, key: string) => {
    if (!key.trim()) return;
    setSaveStates((prev) => ({ ...prev, [providerId]: 'saving' }));
    try {
      const res = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/keys/${providerId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: key.trim() }),
        },
      );
      if (!res.ok) throw new Error('save failed');
      setApiKeys((prev) => ({ ...prev, [providerId]: '' }));
      setSaveStates((prev) => ({ ...prev, [providerId]: 'saved' }));
      await loadStatuses();
      await refetchClientConfig();
    } catch {
      setSaveStates((prev) => ({ ...prev, [providerId]: 'error' }));
    }
  };

  const handleRemove = async (providerId: string) => {
    setSaveStates((prev) => ({ ...prev, [providerId]: 'saving' }));
    try {
      const res = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/keys/${providerId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('remove failed');
      setSaveStates((prev) => ({ ...prev, [providerId]: 'idle' }));
      setTestStates((prev) => ({ ...prev, [providerId]: 'idle' }));
      await loadStatuses();
      await refetchClientConfig();
    } catch {
      setSaveStates((prev) => ({ ...prev, [providerId]: 'error' }));
    }
  };

  const handleTest = async (providerId: string) => {
    const model = AI_PROVIDER_TEST_MODELS[providerId as KeyedAiProviderId];
    setTestStates((prev) => ({ ...prev, [providerId]: 'testing' }));
    try {
      const res = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'user', content: 'Reply with the single word OK.' },
            ],
            max_tokens: 16,
          }),
        },
      );
      if (!res.ok) throw new Error('test failed');
      setTestStates((prev) => ({ ...prev, [providerId]: 'success' }));
    } catch {
      setTestStates((prev) => ({ ...prev, [providerId]: 'error' }));
    }
  };

  const saveLabel = (state: string, configured: boolean) => {
    if (state === 'saving') return t`Saving…`;
    if (state === 'saved') return t`Saved`;
    if (state === 'error') return t`Save failed`;
    return configured ? t`Replace key` : t`Save key`;
  };

  const testLabel = (state: string) => {
    if (state === 'testing') return t`Testing…`;
    if (state === 'success') return t`Connected`;
    if (state === 'error') return t`Test failed`;
    return t`Test connection`;
  };

  return (
    <SettingsPageLayout
      title={t`AI Providers`}
      links={[
        { children: t`Workspace`, href: getSettingsPath(SettingsPath.General) },
        { children: t`AI Providers` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`AI Providers`}
            description={t`Bring your own API key to power lead generation and AI features. Keys are encrypted in your workspace database, only sent to the provider you pick, and never shown again after saving.`}
          />
        </Section>

        <Section>
          <H3Title title={t`Configure providers`} />

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {PROVIDERS.map((provider) => {
              const configured = getConfigured(provider.id);
              const saveState = saveStates[provider.id] ?? 'idle';

              return (
                <div
                  key={provider.id}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: provider.color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {provider.name}
                        {configured && (
                          <IconCheck
                            size={16}
                            color="green"
                            style={{ marginLeft: 8, verticalAlign: 'middle' }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {provider.description}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="password"
                      autoComplete="off"
                      aria-label={`${provider.name} API key`}
                      placeholder={
                        configured
                          ? t`Key saved. Paste a new one to replace it.`
                          : `Paste your ${provider.envKey} here…`
                      }
                      value={apiKeys[provider.id] ?? ''}
                      onChange={(e) =>
                        setApiKeys((prev) => ({
                          ...prev,
                          [provider.id]: e.target.value,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        outline: 'none',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                      }}
                    />
                    {provider.isLocal ? (
                      <IconInfoCircle size={20} color="grey" />
                    ) : (
                      <Button
                        onClick={() =>
                          handleSave(provider.id, apiKeys[provider.id] ?? '')
                        }
                        disabled={
                          saveState === 'saving' ||
                          !apiKeys[provider.id]?.trim()
                        }
                        title={saveLabel(saveState, configured)}
                      />
                    )}
                  </div>

                  {!provider.isLocal && configured && (
                    <div
                      style={{ marginTop: '12px', display: 'flex', gap: '8px' }}
                    >
                      <Button
                        onClick={() => handleTest(provider.id)}
                        disabled={testStates[provider.id] === 'testing'}
                        title={testLabel(testStates[provider.id] ?? 'idle')}
                        variant="secondary"
                      />
                      <Button
                        onClick={() => handleRemove(provider.id)}
                        disabled={saveState === 'saving'}
                        title={t`Remove key`}
                        variant="secondary"
                        accent="danger"
                      />
                      {testStates[provider.id] === 'error' && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: 'red',
                            fontSize: 12,
                          }}
                        >
                          <IconAlertTriangle size={16} />{' '}
                          {t`Connection failed. Check your key.`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
