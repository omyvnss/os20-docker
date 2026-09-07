import { useEffect, useState } from 'react';
import { useLingui } from '@lingui/react/macro';

import { H2Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';
import { Button } from 'twenty-ui/input';
import {
  IconCheck,
  IconTrash,
} from 'twenty-ui/icon';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type WebAgent = {
  id: string;
  name: string;
  baseUrl: string;
  allowPrivateNetwork: boolean;
  enabled: boolean;
  hasKey: boolean;
  capabilities: { name?: string; lead_fetch?: boolean } | null;
  lastTestedAt: string | null;
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

export const WebAgentsSettings = () => {
  const { t } = useLingui();
  const base = REACT_APP_SERVER_BASE_URL;

  const [agents, setAgents] = useState<WebAgent[]>([]);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [allowPrivateNetwork, setAllowPrivateNetwork] = useState(false);
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  const load = async () => {
    const response = await fetch(`${base}/web-agents`);

    setAgents(await response.json());
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !baseUrl.trim()) return;

    setAdding(true);
    try {
      await fetch(`${base}/web-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          allowPrivateNetwork,
        }),
      });

      setName('');
      setBaseUrl('');
      setApiKey('');
      setAllowPrivateNetwork(false);
      await load();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${base}/web-agents/${id}`, { method: 'DELETE' });

    await load();
  };

  const handleToggleEnabled = async (agent: WebAgent) => {
    await fetch(`${base}/web-agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !agent.enabled }),
    });

    await load();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestErrors((prev) => ({ ...prev, [id]: '' }));
    try {
      const response = await fetch(`${base}/web-agents/${id}/test`, {
        method: 'POST',
      });
      const result = await response.json();

      if (!result.ok) {
        setTestErrors((prev) => ({
          ...prev,
          [id]: result.error || 'Test failed',
        }));
      }
    } catch (error) {
      setTestErrors((prev) => ({
        ...prev,
        [id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setTestingId(null);
      await load();
    }
  };

  const statusOf = (agent: WebAgent) => {
    if (agent.capabilities?.lead_fetch && agent.lastTestedAt) {
      return { label: t`Connected — lead fetching ready`, color: 'green' };
    }

    if (agent.lastTestedAt && !agent.capabilities) {
      return { label: t`Tested but no /lead-fetch endpoint found`, color: 'orange' };
    }

    return { label: t`Not tested yet`, color: 'grey' };
  };

  return (
    <SettingsPageLayout
      title={t`Web Agents`}
      links={[
        { children: t`Workspace`, href: getSettingsPath(SettingsPath.General) },
        { children: t`Web Agents` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Your web agents`}
            description={t`Register external agent services. Once connected, each enabled agent appears as a source in Lead Generation and as a lead-fetch tool in Ask AI.`}
          />
        </Section>

        {agents.length === 0 && (
          <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
            {t`No web agents yet — register one below.`}
          </div>
        )}

        {agents.map((agent) => {
          const status = statusOf(agent);

          return (
            <div key={agent.id} style={cardStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {agent.name}
                  {!agent.enabled && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'grey' }}>
                      {t`(disabled)`}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{agent.baseUrl}</div>
                {testErrors[agent.id] ? (
                  <div style={{ fontSize: 12, color: '#e5484d', marginTop: 4 }}>
                    {testErrors[agent.id]}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <span style={{ color: status.color === 'green' ? '#30a46c' : status.color === 'orange' ? '#ffb224' : 'grey' }}>
                      {status.label}
                    </span>
                    {status.color === 'green' && (
                      <IconCheck size={14} color="green" style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={() => handleToggleEnabled(agent)}
                title={agent.enabled ? t`Disable` : t`Enable`}
              />
              <Button onClick={() => handleTest(agent.id)} disabled={testingId !== null} title={t`Test`} />
              <Button onClick={() => handleDelete(agent.id)} accent="danger" title={t`Delete`} Icon={IconTrash} />
            </div>
          );
        })}

        <Section>
          <H2Title
            title={t`Register an agent`}
            description={t`The agent must answer GET / with its capability and POST /lead-fetch with { leads }. Auth is a Bearer API key you choose here.`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 560 }}>
            <input style={inputStyle} placeholder={t`Agent name (e.g. scraper-bot)`} value={name} onChange={(e) => setName(e.target.value)} />
            <input style={inputStyle} placeholder={t`Base URL (e.g. http://localhost:8000)`} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            <input style={inputStyle} type="password" placeholder={t`API key`} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#aaa' }}>
              <input type="checkbox" checked={allowPrivateNetwork} onChange={(e) => setAllowPrivateNetwork(e.target.checked)} />
              {t`Agent runs on a private network (e.g. your laptop / localhost)`}
            </label>
            <div>
              <Button onClick={handleAdd} disabled={adding || !name.trim() || !baseUrl.trim()} title={t`Add agent`} />
            </div>
          </div>
        </Section>

        {agents.length > 0 && (
          <Section>
            <H2Title
              title={t`How to use`}
              description={t`Lead Generation → "15 Free Sources" shows one Web Agents card per enabled agent. In Ask AI, say "use my web agent to find leads for …".`}
            />
          </Section>
        )}
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};