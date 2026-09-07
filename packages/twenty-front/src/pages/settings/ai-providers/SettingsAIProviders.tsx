import { useEffect, useState } from 'react';
import { useLingui } from '@lingui/react/macro';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { H2Title, H3Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';
import { Button } from 'twenty-ui/input';
import {
  IconKey,
  IconPlug,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
} from 'twenty-ui/icon';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

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

const PROVIDER_MODEL_FOR_TEST: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  google: 'gemini-2.0-flash',
  openrouter: 'openrouter/auto',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3',
};

export const SettingsAIProviders = () => {
  const { t } = useLingui();
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const workspaceId = currentWorkspace?.id;

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<SaveState>({});
  const [testStates, setTestStates] = useState<TestState>({});
  const [statuses, setStatuses] = useState<ProviderKeyStatus[]>([]);

  useEffect(() => {
    if (!workspaceId) return;

    fetch(`${REACT_APP_SERVER_BASE_URL}/ai-provider/keys/${workspaceId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setStatuses(data);
        }
      })
      .catch(() => setStatuses([]));
  }, [workspaceId]);

  const getConfigured = (providerId: string) =>
    statuses.find((s) => s.provider === providerId)?.hasKey ?? false;

  const handleSave = async (providerId: string, key: string) => {
    if (!workspaceId || !key.trim()) return;
    setSaveStates((prev) => ({ ...prev, [providerId]: 'saving' }));
    try {
      const res = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/keys/${workspaceId}/${providerId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: key.trim() }),
        },
      );
      if (!res.ok) throw new Error('save failed');
      setStatuses((prev) => {
        const next = [...prev.filter((s) => s.provider !== providerId)];
        next.push({ provider: providerId, hasKey: true });
        return next;
      });
      setSaveStates((prev) => ({ ...prev, [providerId]: 'saved' }));
    } catch {
      setSaveStates((prev) => ({ ...prev, [providerId]: 'error' }));
    }
  };

  const handleTest = async (providerId: string) => {
    if (!workspaceId) return;
    const model = PROVIDER_MODEL_FOR_TEST[providerId];
    setTestStates((prev) => ({ ...prev, [providerId]: 'testing' }));
    try {
      const res = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            model,
            messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
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

  const saveLabel = (state: string) => {
    if (state === 'saving') return 'Saving…';
    if (state === 'saved') return 'Saved ✓';
    if (state === 'error') return 'Save failed';
    return 'Save key';
  };

  const testLabel = (state: string) => {
    if (state === 'testing') return 'Testing…';
    if (state === 'success') return 'Connected ✓';
    if (state === 'error') return 'Test failed';
    return 'Test connection';
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
            description={t`Bring your own API key to power lead generation and AI features. Keys are stored locally and encrypted — they never leave this device.`}
          />
        </Section>

        <Section>
          <H3Title title={t`Configure providers`} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {PROVIDERS.map((provider) => {
              const configured = getConfigured(provider.id);

              return (
                <div
                  key={provider.id}
                  style={{
                    border: '1px solid rgba(0,0,0,0.08)',
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
                      placeholder={`Paste your ${provider.envKey} here…`}
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
                        onClick={() => handleSave(provider.id, apiKeys[provider.id] ?? '')}
                        disabled={saveStates[provider.id] === 'saving'}
                        title={saveLabel(saveStates[provider.id] ?? 'idle')}
                      />
                    )}
                  </div>

                  {!provider.isLocal && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      {configured && (
                        <Button
                          onClick={() => handleTest(provider.id)}
                          disabled={testStates[provider.id] === 'testing'}
                          title={testLabel(testStates[provider.id] ?? 'idle')}
                          variant="secondary"
                        />
                      )}
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
                          {t`Connection failed — check your key.`}
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
