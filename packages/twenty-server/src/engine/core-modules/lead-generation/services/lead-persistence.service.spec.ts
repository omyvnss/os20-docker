import { type Lead } from 'src/engine/core-modules/lead-generation/interfaces/lead-generation.interface';
import { type LeadByokService } from 'src/engine/core-modules/lead-generation/services/lead-byok.service';
import {
  LeadPersistenceService,
  readStoredLeads,
  SAVED_LEADS_CLEANUP_VERSION,
} from 'src/engine/core-modules/lead-generation/services/lead-persistence.service';
import { type KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';

const WORKSPACE_ID = 'workspace-1';

const lead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-1',
  company: 'Acme',
  companyUrl: 'https://acme.com/',
  domain: 'acme.com',
  industry: 'Software',
  size: 'Unknown',
  location: 'Berlin, Germany',
  description: 'SaaS billing',
  contacts: [],
  score: 70,
  source: 'web_search',
  foundAt: new Date('2026-09-01T00:00:00Z'),
  reason: 'SaaS in Berlin',
  ...overrides,
});

// Rows as they were saved before the cleanup existed.
const legacyLeads = [
  lead({
    id: 'week',
    company: 'Berlin SaaS Week',
    companyUrl: 'https://berlinsaasweek.com/',
    domain: 'berlinsaasweek.com',
    score: 80,
  }),
  lead({
    id: 'jobs',
    company: 'Berlin Startup Jobs',
    companyUrl: 'https://berlinstartupjobs.com/',
    domain: 'berlinstartupjobs.com',
    score: 78,
  }),
  lead({
    id: 'map',
    company: 'startup-map.berlin',
    companyUrl: 'https://startup-map.berlin/',
    domain: 'startup-map.berlin',
    score: 72,
  }),
  lead({
    id: 'community',
    company: 'Trailblazer Community',
    companyUrl: 'https://trailblazer.me/',
    domain: 'trailblazer.me',
    score: 65,
  }),
  lead({
    id: 'origami',
    company: 'Origami gets customers for you.',
    companyUrl: 'https://origami.chat/',
    domain: 'origami.chat',
    phone: '6442713809951',
    emails: ['example@gmail.com', 'hello@origami.chat'],
    score: 75,
    reason: undefined,
  }),
  lead({
    id: 's2',
    company: 'https://s2-labs.com/',
    companyUrl: 'https://s2-labs.com/',
    domain: undefined,
    phone: '00000040',
    score: 70,
  }),
  lead({
    id: 'cledara',
    company: 'Cledara',
    companyUrl: 'https://data.cledara.com/',
    domain: 'data.cledara.com',
    phone: '030 1234567',
    emails: ['noreply@cledara.com', 'sales@cledara.com'],
    score: 68,
    reason: '',
  }),
];

const setup = (storedValue: unknown) => {
  const store = { value: storedValue };
  const keyValuePairService = {
    get: jest.fn(async () =>
      store.value === undefined ? [] : [{ value: store.value }],
    ),
    set: jest.fn(async ({ value }: { value: unknown }) => {
      store.value = value;
    }),
  };
  const byok = { resolveWorkspaceId: jest.fn(async () => WORKSPACE_ID) };
  const service = new LeadPersistenceService(
    keyValuePairService as unknown as KeyValuePairService,
    byok as unknown as LeadByokService,
  );

  return { service, keyValuePairService, store };
};

describe('LeadPersistenceService saved leads cleanup', () => {
  it('cleans a legacy array payload once on read and stores a version marker', async () => {
    const { service, keyValuePairService, store } = setup(legacyLeads);

    const leads = await service.list(WORKSPACE_ID);

    expect(leads.map((row) => row.id)).toEqual(['origami', 's2', 'cledara']);
    expect(leads.find((row) => row.id === 'origami')).toMatchObject({
      company: 'Origami',
      emails: ['hello@origami.chat'],
    });
    expect(leads.find((row) => row.id === 'origami')?.phone).toBeUndefined();
    expect(leads.find((row) => row.id === 'origami')?.reason).toBe(
      'Software business; located in Berlin, Germany; found via web search',
    );
    expect(leads.find((row) => row.id === 's2')).toMatchObject({
      company: 'S2 Labs',
      domain: 's2-labs.com',
    });
    expect(leads.find((row) => row.id === 's2')?.phone).toBeUndefined();
    expect(leads.find((row) => row.id === 'cledara')).toMatchObject({
      domain: 'cledara.com',
      phone: '+49301234567',
      emails: ['sales@cledara.com'],
    });
    expect(keyValuePairService.set).toHaveBeenCalledTimes(1);
    expect(store.value).toEqual({
      cleanupVersion: SAVED_LEADS_CLEANUP_VERSION,
      leads,
    });
  });

  it('does not clean or write again once the payload is current', async () => {
    const { service, keyValuePairService } = setup(legacyLeads);

    await service.list(WORKSPACE_ID);
    keyValuePairService.set.mockClear();

    const leads = await service.list(WORKSPACE_ID);

    expect(leads).toHaveLength(3);
    expect(keyValuePairService.set).not.toHaveBeenCalled();
  });

  it('cleans on demand and reports what was removed', async () => {
    const { service, store } = setup({
      cleanupVersion: SAVED_LEADS_CLEANUP_VERSION,
      leads: legacyLeads,
    });

    const result = await service.clean(WORKSPACE_ID);

    expect(result.removed).toBe(4);
    expect(result.total).toBe(3);
    expect((store.value as { leads: Lead[] }).leads).toHaveLength(3);
  });

  it('sanitizes incoming leads on save and lets a re-found lead replace its copy', async () => {
    const { service, store } = setup({
      cleanupVersion: SAVED_LEADS_CLEANUP_VERSION,
      leads: [lead({ id: 'old-acme', score: 90 })],
    });

    await service.save([
      lead({ id: 'new-acme', score: 60, phone: '20260410' }),
      lead({
        id: 'summit',
        company: 'SaaStr Annual Summit',
        companyUrl: 'https://saastr.com/',
        domain: 'saastr.com',
      }),
    ]);

    const saved = (store.value as { leads: Lead[] }).leads;

    expect(saved.map((row) => row.id)).toEqual(['new-acme']);
    expect(saved[0].phone).toBeUndefined();
  });

  it('removes a lead by its key from a legacy payload', async () => {
    const { service, store } = setup(legacyLeads);

    await expect(service.remove(WORKSPACE_ID, 'cledara.com')).resolves.toBe(
      true,
    );
    expect(
      (store.value as { leads: Lead[] }).leads.map((row) => row.id),
    ).toEqual(['origami', 's2']);
  });

  it('reads empty and malformed payloads as no leads', () => {
    expect(readStoredLeads(undefined)).toEqual({
      leads: [],
      cleanupVersion: 0,
    });
    expect(readStoredLeads({ leads: 'x' })).toEqual({
      leads: [],
      cleanupVersion: 0,
    });
  });
});
