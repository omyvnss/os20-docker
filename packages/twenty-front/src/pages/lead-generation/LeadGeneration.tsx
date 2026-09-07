import { useEffect, useState } from 'react';
import { useLingui } from '@lingui/react/macro';

import { H2Title, H3Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';
import { Button } from 'twenty-ui/input';
import { IconSearch, IconBrain, IconSend, IconCopy } from 'twenty-ui/icon';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { LeadSourcesPanel } from './components/LeadSourcesPanel';

interface Lead {
  id: string;
  company: string;
  companyUrl: string;
  industry: string;
  size: string;
  location: string;
  description: string;
  score: number;
  source: string;
}

interface ICP {
  industry: string;
  companySize: string;
  location: string;
  keywords: string;
  maxResults: number;
}

const COMPANY_SIZES = [
  { value: 'startup', label: 'Startup (1-10)' },
  { value: 'small', label: 'Small (10-50)' },
  { value: 'medium', label: 'Medium (50-200)' },
  { value: 'large', label: 'Enterprise (200+)' },
];

const INDUSTRIES = [
  'SaaS', 'Fintech', 'Healthtech', 'Edtech', 'E-commerce',
  'Agency', 'Consulting', 'Manufacturing', 'Real Estate', 'Other',
];

export const LeadGeneration = () => {
  const { t } = useLingui();
  const [mode, setMode] = useState<'ai' | 'sources'>('ai');
  const [icp, setIcp] = useState<ICP>({
    industry: '',
    companySize: '',
    location: '',
    keywords: '',
    maxResults: 10,
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [outreachMessage, setOutreachMessage] = useState('');
  const [generatingOutreach, setGeneratingOutreach] = useState(false);

  useEffect(() => {
    fetch('/lead-generation/leads')
      .then((response) => response.json())
      .then((saved) => {
        if (Array.isArray(saved) && saved.length > 0) {
          setLeads(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch('/lead-generation/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icp: {
            industry: icp.industry,
            companySize: icp.companySize,
            location: icp.location,
            keywords: icp.keywords.split(',').map((k) => k.trim()).filter(Boolean),
            maxResults: icp.maxResults,
          },
        }),
      });

      const data = await response.json();
      setLeads(data.leads || []);
      setSearchQuery(data.searchQuery || '');
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOutreach = async (lead: Lead) => {
    setGeneratingOutreach(true);
    setSelectedLead(lead);
    try {
      const response = await fetch('/lead-generation/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          icp: {
            industry: icp.industry,
            keywords: icp.keywords.split(',').map((k) => k.trim()),
          },
        }),
      });

      const data = await response.json();
      setOutreachMessage(data.message || '');
    } catch (error) {
      console.error('Outreach generation failed:', error);
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  return (
    <SettingsPageLayout
      title={t`Lead Generation`}
      links={[
        { children: t`Workspace`, href: getSettingsPath(SettingsPath.General) },
        { children: t`Lead Generation` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Find your leads`}
            description={
              mode === 'ai'
                ? t`Describe your ideal customer and AI will find matching companies for you. 100% free — no paid APIs required.`
                : t`Pick a free source and search real platforms for companies and contacts. Add them to your CRM with one click.`
            }
          />
        </Section>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            background: 'var(--background-secondary)',
            padding: '4px',
            borderRadius: '10px',
            width: 'fit-content',
            marginBottom: '24px',
          }}
        >
          <button
            onClick={() => setMode('ai')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background:
                mode === 'ai'
                  ? 'var(--background-primary)'
                  : 'transparent',
              color: 'var(--foreground-primary)',
              boxShadow:
                mode === 'ai'
                  ? '0 0 0 1px var(--border-color-soft, #ffffff1a)'
                  : undefined,
            }}
          >
            AI Discovery
          </button>
          <button
            onClick={() => setMode('sources')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background:
                mode === 'sources'
                  ? 'var(--background-primary)'
                  : 'transparent',
              color: 'var(--foreground-primary)',
              boxShadow:
                mode === 'sources'
                  ? '0 0 0 1px var(--border-color-soft, #ffffff1a)'
                  : undefined,
            }}
          >
            15 Free Sources
          </button>
        </div>

        {mode === 'sources' ? (
          <LeadSourcesPanel />
        ) : (
          <>
        <Section>
          <H3Title
            title={t`Ideal Customer Profile`}
            description={t`Tell us who you're looking for.`}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '16px',
            }}
          >
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Industry
              </label>
              <select
                value={icp.industry}
                onChange={(e) => setIcp({ ...icp, industry: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--background-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--foreground-primary)',
                  fontSize: '14px',
                }}
              >
                <option value="">Any Industry</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Company Size
              </label>
              <select
                value={icp.companySize}
                onChange={(e) => setIcp({ ...icp, companySize: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--background-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--foreground-primary)',
                  fontSize: '14px',
                }}
              >
                <option value="">Any Size</option>
                {COMPANY_SIZES.map((size) => (
                  <option key={size.value} value={size.value}>{size.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Location
              </label>
              <input
                type="text"
                placeholder="e.g., India, USA, Remote"
                value={icp.location}
                onChange={(e) => setIcp({ ...icp, location: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--background-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--foreground-primary)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Keywords
              </label>
              <input
                type="text"
                placeholder="e.g., AI, machine learning, automation"
                value={icp.keywords}
                onChange={(e) => setIcp({ ...icp, keywords: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--background-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--foreground-primary)',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Button
              title={loading ? 'Searching...' : 'Find Leads'}
              variant="primary"
              accent="blue"
              Icon={IconSearch}
              onClick={handleSearch}
              disabled={loading}
            />
            {searchQuery && (
              <span style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                Search: "{searchQuery}"
              </span>
            )}
          </div>
        </Section>

        {leads.length > 0 && (
          <Section>
            <H3Title
              title={`Found ${leads.length} Leads`}
              description="Companies matching your criteria, scored by AI."
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  style={{
                    background: 'var(--background-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'border-color 0.2s',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedLead(lead)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                        {lead.company}
                      </h3>
                      <a
                        href={lead.companyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.companyUrl}
                      </a>
                    </div>
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: `${getScoreColor(lead.score)}20`,
                        color: getScoreColor(lead.score),
                      }}
                    >
                      {lead.score}%
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '12px' }}>
                    {lead.industry && <span>Industry: {lead.industry}</span>}
                    {lead.size && <span>Size: {lead.size}</span>}
                    {lead.location && <span>Location: {lead.location}</span>}
                  </div>

                  {lead.description && (
                    <p style={{ fontSize: '13px', color: 'var(--foreground-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
                      {lead.description.substring(0, 200)}...
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      title={generatingOutreach && selectedLead?.id === lead.id ? 'Generating...' : 'Generate Outreach'}
                      variant="secondary"
                      size="small"
                      Icon={IconBrain}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateOutreach(lead);
                      }}
                      disabled={generatingOutreach}
                    />
                    <Button
                      title="Visit Website"
                      variant="secondary"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(lead.companyUrl, '_blank');
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {outreachMessage && selectedLead && (
          <Section>
            <H3Title
              title={`Outreach for ${selectedLead.company}`}
              description="AI-generated personalized message."
            />
            <div
              style={{
                background: 'var(--background-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'var(--foreground-primary)',
                  marginBottom: '16px',
                }}
              >
                {outreachMessage}
              </pre>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  title="Copy Message"
                  variant="secondary"
                  size="small"
                  Icon={IconCopy}
                  onClick={() => copyToClipboard(outreachMessage)}
                />
                <Button
                  title="Open Email"
                  variant="secondary"
                  size="small"
                  Icon={IconSend}
                  onClick={() => {
                    const subject = encodeURIComponent(`Partnership Opportunity - ${selectedLead.company}`);
                    const body = encodeURIComponent(outreachMessage);
                    window.open(`mailto:?subject=${subject}&body=${body}`);
                  }}
                />
              </div>
            </div>
          </Section>
        )}
          </>
        )}
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
