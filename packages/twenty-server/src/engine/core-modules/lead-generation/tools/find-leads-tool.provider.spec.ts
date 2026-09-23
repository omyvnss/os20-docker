import { FindLeadsToolProvider } from 'src/engine/core-modules/lead-generation/tools/find-leads-tool.provider';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';

jest.mock(
  'src/engine/core-modules/lead-generation/services/lead-generation.service',
  () => ({ LeadGenerationService: class {} }),
);
jest.mock(
  'src/engine/core-modules/lead-generation/services/contact-discovery.service',
  () => ({ ContactDiscoveryService: class {} }),
);
jest.mock(
  'src/engine/core-modules/lead-generation/services/contact-persistence.service',
  () => ({ ContactPersistenceService: class {} }),
);
jest.mock(
  'src/engine/core-modules/record-crud/services/create-record.service',
  () => ({ CreateRecordService: class {} }),
);
jest.mock(
  'src/engine/core-modules/record-crud/services/find-records.service',
  () => ({ FindRecordsService: class {} }),
);

const buildProvider = () => {
  const createRecordService = {
    execute: jest.fn(async ({ objectName }: { objectName: string }) => ({
      success: true,
      result: { id: `${objectName}-id` },
      recordReferences: [],
    })),
  };
  const findRecordsService = {
    execute: jest.fn(async () => ({ success: true, result: { records: [] } })),
  };
  const contactDiscoveryService = {
    discoverCompanyContacts: jest.fn(async () => ({
      website: 'https://acme.com',
      domain: 'acme.com',
      pagesFetched: ['https://acme.com/'],
      people: [
        { fullName: 'Jane Doe', emailStatus: 'found' },
        { fullName: 'John Roe', emailStatus: 'guessed' },
        { fullName: 'Ann Poe' },
      ],
      companyEmails: [],
      smtp: 'unavailable',
      notes: [],
    })),
  };

  const contactPersistenceService = {
    saveContacts: jest.fn(
      async ({
        contacts,
      }: {
        contacts: { firstName: string; lastName?: string }[];
      }) => ({
        created: contacts.length,
        skipped: 0,
        people: contacts.map((contact, index) => ({
          id: `person-${index}`,
          name: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
          saved: true,
        })),
      }),
    ),
  };

  const leadGenerationService = {
    findLeads: jest.fn(async () => ({
      leads: [
        {
          company: 'Cledara',
          companyUrl: 'https://data.cledara.com/',
          domain: 'data.cledara.com',
        },
      ],
      stats: { durationMs: 1000 },
      hints: [],
    })),
  };

  const provider = new FindLeadsToolProvider(
    leadGenerationService as never,
    createRecordService as never,
    findRecordsService as never,
    contactDiscoveryService as never,
    contactPersistenceService as never,
  );

  return {
    provider,
    createRecordService,
    contactDiscoveryService,
    contactPersistenceService,
  };
};

const context = {
  workspaceId: 'workspace-id',
  authContext: { workspace: { id: 'workspace-id' } },
  rolePermissionConfig: undefined,
  actorContext: undefined,
} as unknown as ToolProviderContext;

describe('FindLeadsToolProvider contacts', () => {
  it('saves contacts through the shared persistence and reports withheld guesses', async () => {
    const { provider, contactPersistenceService } = buildProvider();

    const output = await provider.executeStaticTool(
      'save_contacts',
      {
        contacts: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@acme.com',
            emailStatus: 'found',
            companyDomain: 'acme.com',
          },
          {
            firstName: 'John',
            lastName: 'Roe',
            email: 'john.roe@acme.com',
            emailStatus: 'guessed',
            companyDomain: 'acme.com',
          },
        ],
      },
      context,
    );

    expect(contactPersistenceService.saveContacts).toHaveBeenCalledTimes(1);
    expect(contactPersistenceService.saveContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-id',
        companyId: 'company-id',
        defaultLeadSource: 'Ask AI',
        contacts: [
          expect.objectContaining({
            email: 'jane@acme.com',
            emailStatus: 'found',
          }),
          expect.objectContaining({
            email: 'john.roe@acme.com',
            emailStatus: 'guessed',
          }),
        ],
      }),
    );
    expect(output.result).toEqual(
      expect.objectContaining({
        saved: ['Jane Doe', 'John Roe'],
        withheldEmails: [
          {
            name: 'John Roe',
            email: 'john.roe@acme.com',
            emailStatus: 'guessed',
          },
        ],
      }),
    );
    expect(output.recordReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectNameSingular: 'person',
          recordId: 'person-0',
        }),
      ]),
    );
    expect(output.message).toContain('1 unconfirmed email(s) not saved');
  });

  it('summarises email statuses from find_company_contacts', async () => {
    const { provider, contactDiscoveryService } = buildProvider();

    const output = await provider.executeStaticTool(
      'find_company_contacts',
      { website: 'acme.com' },
      context,
    );

    expect(
      contactDiscoveryService.discoverCompanyContacts,
    ).toHaveBeenCalledWith('acme.com', { verifyEmails: undefined });
    expect(output.success).toBe(true);
    expect(output.message).toBe(
      'Found 3 people on acme.com (emails: 1 found, 1 guessed). Guessed emails are unconfirmed and are not saved as primary email.',
    );
  });
});

describe('FindLeadsToolProvider find_leads', () => {
  it('saves the company at the root of its registrable domain', async () => {
    const { provider, createRecordService } = buildProvider();

    await provider.executeStaticTool(
      'find_leads',
      { request: 'saas spend management' },
      context,
    );

    const [[{ objectRecord }]] = createRecordService.execute.mock
      .calls as unknown as [
      [{ objectRecord: { domainName: { primaryLinkUrl: string } } }],
    ];

    expect(objectRecord.domainName.primaryLinkUrl).toBe('https://cledara.com');
  });
});
