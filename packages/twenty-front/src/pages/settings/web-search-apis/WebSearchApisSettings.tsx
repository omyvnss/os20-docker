import { useEffect, useState } from 'react';
import { useLingui } from '@lingui/react/macro';

import { H2Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';
import { Button } from 'twenty-ui/input';
import { IconEye, IconEyeOff, IconTrash } from 'twenty-ui/icon';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type WebSearchApi = {
  id: string;
  provider: string;
  apiKey: string;
  createdAt: string;
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  outline: 'none',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  marginBottom: '10px',
};

export const WebSearchApisSettings = () => {
  const { t } = useLingui();
  const base = REACT_APP_SERVER_BASE_URL;

  const [apis, setApis] = useState<WebSearchApi[]>([]);
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [adding, setAdding] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = async () => {
    const response = await fetch(`${base}/web-search-apis`);

    setApis(await response.json());
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!provider.trim() || !apiKey.trim()) return;

    setAdding(true);
    try {
      await fetch(`${base}/web-search-apis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      setProvider('');
      setApiKey('');
      await load();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${base}/web-search-apis/${id}`, { method: 'DELETE' });

    await load();
  };

  return (
    <SettingsPageLayout
      title={t`Web Search APIs`}
      links={[
        { children: t`Workspace`, href: getSettingsPath(SettingsPath.General) },
        { children: t`Web Search APIs` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Your web search API keys`}
            description={t`Paste the API keys from the web search services you use (e.g. Bing, Brave, SerpAPI, Tavily). Keys are encrypted and stored in your workspace.`}
          />
        </Section>

        {apis.length === 0 && (
          <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
            {t`No keys saved yet — add one below.`}
          </div>
        )}

        {apis.map((api) => (
          <div key={api.id} style={cardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{api.provider}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {revealed[api.id] ? api.apiKey : '••••••••••••••••'}
              </div>
            </div>
            <Button
              onClick={() =>
                setRevealed((prev) => ({
                  ...prev,
                  [api.id]: !prev[api.id],
                }))
              }
              Icon={revealed[api.id] ? IconEyeOff : IconEye}
              variant="secondary"
            />
            <Button
              onClick={() => handleDelete(api.id)}
              accent="danger"
              title={t`Delete`}
              Icon={IconTrash}
            />
          </div>
        ))}

        <Section>
          <H2Title
            title={t`Add a web search API key`}
            description={t`Got a key from a search service? Store it here so it's readable from your workspace.`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 560 }}>
            <input
              style={inputStyle}
              placeholder={t`Service / provider (e.g. firecrawl, tavily, brave, serpapi)`}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
            <input
              style={inputStyle}
              type="password"
              placeholder={t`Your API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <div>
              <Button
                onClick={handleAdd}
                disabled={adding || !provider.trim() || !apiKey.trim()}
                title={t`Save key`}
              />
            </div>
          </div>
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};