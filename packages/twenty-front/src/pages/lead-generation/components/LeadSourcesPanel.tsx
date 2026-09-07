import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Button } from 'twenty-ui/input';
import { IconCheck, IconExternalLink, IconPlus, IconSearch } from 'twenty-ui/icon';
import { useLingui } from '@lingui/react/macro';
import gql from 'graphql-tag';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export type LeadSourceCriteriaField = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'number' | 'toggle';
  placeholder?: string;
  help?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
};

export type LeadSource = {
  id: string;
  name: string;
  description: string;
  category: string;
  access: 'FREE' | 'FREE_LIMITED' | 'SCRAPE';
  note?: string;
  criteriaFields: LeadSourceCriteriaField[];
};

export type LeadCandidate = {
  id: string;
  sourceId: string;
  platform: string;
  title: string;
  companyName: string;
  industry?: string;
  location?: string;
  website?: string;
  phone?: string;
  email?: string;
  rating?: number;
  snippet?: string;
  url?: string;
};

type CriteriaValues = Record<string, string | number | boolean>;

const StyledCard = styled.div`
  border: 1px solid ${themeCssVariables.background.transparent.medium};
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;

  :hover {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 9px 12px;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.background.transparent.medium};
  border-radius: 8px;
  color: ${themeCssVariables.font.color.primary};
  font-size: 13px;

  :focus {
    outline: 1px solid ${themeCssVariables.color.blue};
  }
`;

const StyledSelect = styled.select`
  width: 100%;
  padding: 9px 12px;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.background.transparent.medium};
  border-radius: 8px;
  color: ${themeCssVariables.font.color.primary};
  font-size: 13px;
`;

export const LeadSourcesPanel = () => {
  const { t } = useLingui();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const apolloClient = useApolloCoreClient();

  const [sources, setSources] = useState<LeadSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<CriteriaValues>({});
  const [loadingSources, setLoadingSources] = useState(true);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<LeadCandidate[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch('/lead-generation/sources')
      .then((response) => response.json())
      .then((data: LeadSource[]) => {
        setSources(data);
      })
      .catch(() => {
        enqueueErrorSnackBar({ message: t`Could not load lead sources.` });
      })
      .finally(() => setLoadingSources(false));
  }, [enqueueErrorSnackBar, t]);

  const groupedSources = useMemo(() => {
    const groups = new Map<string, LeadSource[]>();

    for (const source of sources) {
      const list = groups.get(source.category) ?? [];
      list.push(source);
      groups.set(source.category, list);
    }

    return Array.from(groups.entries());
  }, [sources]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [sources, selectedSourceId],
  );

  useEffect(() => {
    if (!selectedSource) {
      return;
    }

    const defaults: CriteriaValues = {};

    for (const field of selectedSource.criteriaFields) {
      if (field.defaultValue !== undefined && field.key !== 'maxResults') {
        defaults[field.key] = field.defaultValue;
      }
    }

    const maxResultsField = selectedSource.criteriaFields.find(
      (field) => field.key === 'maxResults',
    );
    defaults.maxResults = maxResultsField?.defaultValue ?? 15;

    setCriteria(defaults);
    setCandidates([]);
    setSelected({});
    setNote('');
  }, [selectedSource]);

  const renderCriteriaField = useCallback(
    (field: LeadSourceCriteriaField) => {
      const value = criteria[field.key];

      if (field.type === 'select') {
        return (
          <StyledSelect
            value={(value as string) ?? ''}
            onChange={(event) =>
              setCriteria({ ...criteria, [field.key]: event.target.value })
            }
          >
            {!field.options?.some((option) => option.value === value) && (
              <option value="" />
            )}
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </StyledSelect>
        );
      }

      if (field.type === 'number') {
        return (
          <StyledInput
            type="number"
            value={(value as number | string) ?? ''}
            placeholder={field.placeholder}
            onChange={(event) =>
              setCriteria({ ...criteria, [field.key]: Number(event.target.value) })
            }
          />
        );
      }

      return (
        <StyledInput
          type="text"
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(event) =>
            setCriteria({ ...criteria, [field.key]: event.target.value })
          }
        />
      );
    },
    [criteria],
  );

  const handleSearch = async () => {
    if (!selectedSourceId) {
      return;
    }

    setSearching(true);
    setCandidates([]);
    setSelected({});

    try {
      const response = await fetch('/lead-generation/sources-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: selectedSourceId, criteria }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data?.error ?? data?.message ?? t`Search failed.`;
        enqueueErrorSnackBar({ message });
        setNote('');
        return;
      }

      setCandidates(data.candidates ?? []);
      setNote(data.note ?? '');
    } catch {
      enqueueErrorSnackBar({ message: t`Search failed. Check your connection and retry.` });
    } finally {
      setSearching(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleImport = async () => {
    const toImport = candidates.filter((candidate) => selected[candidate.id]);

    if (toImport.length === 0) {
      return;
    }

    setImporting(true);

    let created = 0;
    let failed = 0;

    try {
      for (const candidate of toImport) {
        const shouldCreatePerson = Boolean(candidate.email || candidate.phone);

        const companyResult = await apolloClient.mutate<{
          createCompany: { id: string };
        }>({
          mutation: gql`
            mutation LeadGenCreateCompany($data: CompanyCreateInput!) {
              createCompany(data: $data) {
                id
              }
            }
          `,
          variables: {
            data: {
              name: candidate.companyName.slice(0, 150),
              ...(candidate.website
                ? {
                    domainName: {
                      primaryLinkUrl: candidate.website,
                      primaryLinkLabel: 'Website',
                      secondaryLinks: [],
                    },
                  }
                : {}),
              ...(candidate.location
                ? {
                    address: {
                      addressStreet1: candidate.location.slice(0, 100),
                      country: '',
                      city: '',
                      addressLat: null,
                      addressLng: null,
                      addressLat2: null,
                      addressLng2: null,
                    },
                  }
                : {}),
            },
          },
        });

        const companyId = companyResult.data?.createCompany.id;

        if (shouldCreatePerson && companyId) {
          const nameParts = candidate.title.split(/\s+/);

          await apolloClient.mutate({
            mutation: gql`
              mutation LeadGenCreatePerson($data: PersonCreateInput!) {
                createPerson(data: $data) {
                  id
                }
              }
            `,
            variables: {
              data: {
                name: {
                  firstName:
                    nameParts.length > 1
                      ? nameParts[0]
                      : candidate.companyName,
                  lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
                },
                ...(candidate.email
                  ? { emails: { primaryEmail: candidate.email, additionalEmails: [] } }
                  : {}),
                ...(candidate.phone
                  ? {
                      phones: {
                        primaryPhoneNumber: candidate.phone,
                        primaryPhoneCountryCode: '',
                        primaryPhoneCallingCode: '',
                        additionalPhones: [],
                      },
                    }
                  : {}),
                jobTitle: candidate.industry ?? undefined,
                leadSource: `Lead Finder — ${candidate.platform}`,
                companyId,
              },
            },
          });
        }

        created += 1;
      }
    } catch {
      failed += 1;
    }

    setImporting(false);

    if (created > 0) {
      enqueueSuccessSnackBar({
        message: t`Imported ${created} lead${created === 1 ? '' : 's'} to Companies${failed > 0 ? ` · ${failed} failed` : ''}.`,
      });
      setSelected({});
    } else {
      enqueueErrorSnackBar({ message: t`Import failed. No leads were added.` });
    }
  };

  if (loadingSources) {
    return <div style={{ padding: 24 }}>{t`Loading sources...`}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {groupedSources.map(([category, categorySources]) => (
          <div key={category} style={{ gridColumn: '1 / -1' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--foreground-muted)',
                margin: '4px 0 10px',
              }}
            >
              {category}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}
            >
              {categorySources.map((source) => (
                <StyledCard
                  key={source.id}
                  onClick={() => setSelectedSourceId(source.id)}
                  style={{
                    background:
                      selectedSourceId === source.id
                        ? 'var(--background-tertiary)'
                        : 'var(--background-primary)',
                    border:
                      selectedSourceId === source.id
                        ? `1px solid ${themeCssVariables.color.blue}`
                        : undefined,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{source.name}</strong>
                    {selectedSourceId === source.id && (
                      <IconCheck size={16} color={themeCssVariables.color.blue} />
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                      lineHeight: 1.4,
                    }}
                  >
                    {source.description}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#16a34a20',
                        color: '#16a34a',
                      }}
                    >
                      {source.access === 'FREE'
                        ? 'Free — no key'
                        : source.access === 'FREE_LIMITED'
                          ? 'Free (limited)'
                          : 'Free (scrape)'}
                    </span>
                    {source.note && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {source.note}
                      </span>
                    )}
                  </div>
                </StyledCard>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedSource && (
        <div
          style={{
            border: '1px solid var(--border-color-soft, #ffffff1a)',
            borderRadius: 12,
            padding: 20,
            background: 'var(--background-primary)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {selectedSource.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                {selectedSource.criteriaFields.length} search criteria
              </div>
            </div>
            <Button
              title={searching ? t`Searching...` : t`Search`}
              variant="primary"
              size="small"
              Icon={IconSearch}
              onClick={handleSearch}
              disabled={searching}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            {selectedSource.criteriaFields.map((field) => (
              <div key={field.key}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    display: 'block',
                  }}
                >
                  {field.label}
                </label>
                {renderCriteriaField(field)}
                {field.help && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--foreground-muted)',
                      marginTop: 4,
                    }}
                  >
                    {field.help}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {note && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--foreground-muted)',
            background: 'var(--background-secondary)',
            padding: '10px 14px',
            borderRadius: 8,
          }}
        >
          {note}
        </div>
      )}

      {candidates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {candidates.length} results
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label
                style={{
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedCount === candidates.length}
                  onChange={(event) => {
                    setSelected(
                      Object.fromEntries(
                        candidates.map((candidate) => [
                          candidate.id,
                          event.target.checked,
                        ]),
                      ),
                    );
                  }}
                />
                Select all
              </label>
              <Button
                title={
                  importing
                    ? t`Importing...`
                    : t`Add ${selectedCount || ''} to CRM`.trim()
                }
                variant="secondary"
                size="small"
                Icon={IconPlus}
                disabled={selectedCount === 0 || importing}
                onClick={handleImport}
              />
            </div>
          </div>

          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              style={{
                border: '1px solid var(--border-color-soft, #ffffff1a)',
                borderRadius: 10,
                padding: '12px 14px',
                background: 'var(--background-primary)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={Boolean(selected[candidate.id])}
                onChange={(event) =>
                  setSelected({
                    ...selected,
                    [candidate.id]: event.target.checked,
                  })
                }
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong style={{ fontSize: 14 }}>{candidate.title}</strong>
                  {candidate.rating !== undefined && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#eab30820',
                        color: '#eab308',
                      }}
                    >
                      ★ {candidate.rating}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  {[candidate.industry, candidate.location]
                    .filter(Boolean)
                    .join(' · ')}
                  {candidate.platform && (
                    <>
                      {' · '}
                      <span style={{ fontWeight: 600 }}>
                        {candidate.platform}
                      </span>
                    </>
                  )}
                </div>
                {candidate.snippet && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: 'var(--foreground-secondary)',
                    }}
                  >
                    {candidate.snippet}
                  </p>
                )}
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {candidate.phone && (
                    <span
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--background-secondary)',
                      }}
                    >
                      {candidate.phone}
                    </span>
                  )}
                  {candidate.email && (
                    <span
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--background-secondary)',
                      }}
                    >
                      {candidate.email}
                    </span>
                  )}
                  {candidate.website && (
                    <a
                      href={candidate.website}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--color-blue)',
                      }}
                    >
                      <IconExternalLink size={14} /> Website
                    </a>
                  )}
                  {candidate.url && (
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--color-blue)',
                      }}
                    >
                      <IconExternalLink size={14} /> Source
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};