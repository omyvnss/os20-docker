import {
  buildPersonRecord,
  ContactPersistenceService,
  leadSourceFromUrl,
  savablePrimaryEmail,
  toInternationalPhone,
} from 'src/engine/core-modules/lead-generation/services/contact-persistence.service';

jest.mock(
  'src/engine/core-modules/lead-generation/services/contact-discovery.service',
  () => ({ ContactDiscoveryService: class {} }),
);
jest.mock('src/engine/twenty-orm/utils/build-system-auth-context.util', () => ({
  buildSystemAuthContext: jest.fn(() => ({})),
}));
jest.mock(
  'src/modules/match-participant/utils/add-person-email-filters-to-query-builder',
  () => ({
    addPersonEmailFiltersToQueryBuilder: jest.fn(
      ({ queryBuilder }: { queryBuilder: unknown }) => queryBuilder,
    ),
  }),
);

type ExistingPerson = {
  name?: { firstName: string; lastName: string };
  emails?: { primaryEmail: string; additionalEmails: string[] | null };
};

const buildService = ({
  byEmail = [],
  byCompany = [],
  discovered = [],
}: {
  byEmail?: ExistingPerson[];
  byCompany?: ExistingPerson[];
  discovered?: unknown[];
} = {}) => {
  let nextId = 0;
  const repository = {
    createQueryBuilder: jest.fn(() => ({
      getMany: jest.fn(async () => byEmail),
    })),
    find: jest.fn(async () => byCompany),
    maximum: jest.fn(async () => 5),
    insert: jest.fn(async () => ({ raw: [{ id: `person-${nextId++}` }] })),
  };
  const workspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(async (fn: () => unknown) => fn()),
    getRepository: jest.fn(() => repository),
  };
  const contactDiscoveryService = {
    discoverForCompanyIds: jest.fn(async () => discovered),
  };

  return {
    repository,
    contactDiscoveryService,
    service: new ContactPersistenceService(
      workspaceOrmManager as never,
      contactDiscoveryService as never,
    ),
  };
};

const insertedRecords = (repository: { insert: jest.Mock }) =>
  repository.insert.mock.calls.map(([record]) => record);

describe('contact persistence email rules', () => {
  it('only keeps found and verified emails as primary email', () => {
    expect(savablePrimaryEmail('Jane@Acme.com', 'found')).toBe('jane@acme.com');
    expect(savablePrimaryEmail('jane@acme.com', 'verified')).toBe(
      'jane@acme.com',
    );
    expect(savablePrimaryEmail('jane@acme.com', 'guessed')).toBeUndefined();
    expect(savablePrimaryEmail('jane@acme.com', 'invalid')).toBeUndefined();
    expect(savablePrimaryEmail('not-an-email', 'found')).toBeUndefined();
  });

  it('builds a guessed contact without primary email but with its status', () => {
    const record = buildPersonRecord(
      {
        firstName: 'Tom',
        lastName: 'Braun',
        jobTitle: 'Head of Sales',
        email: 'tom.braun@acme.de',
        emailStatus: 'guessed',
        linkedinUrl: 'https://www.linkedin.com/in/tombraun',
        leadSource: 'Website team page',
      },
      'company-1',
      'Website',
    );

    expect(record.emails).toBeUndefined();
    expect(record.emailStatus).toBe('GUESSED');
    expect(record.leadSource).toBe('Website team page');
    expect(record.jobTitle).toBe('Head of Sales');
    expect(record.companyId).toBe('company-1');
    expect(record.linkedinLink?.primaryLinkUrl).toBe(
      'https://www.linkedin.com/in/tombraun',
    );
  });

  it('keeps only international phone numbers', () => {
    expect(toInternationalPhone('+49 30 12345678')).toEqual({
      primaryPhoneNumber: '3012345678',
      primaryPhoneCountryCode: 'DE',
      primaryPhoneCallingCode: '+49',
      additionalPhones: [],
    });
    expect(toInternationalPhone('030 12345678')).toBeUndefined();
    expect(toInternationalPhone(undefined)).toBeUndefined();
  });

  it('labels lead sources from the page they came from', () => {
    expect(leadSourceFromUrl('https://acme.de/impressum')).toBe('Impressum');
    expect(leadSourceFromUrl('https://acme.de/team')).toBe('Website team page');
    expect(leadSourceFromUrl('https://acme.de/contact')).toBe(
      'Website contact page',
    );
    expect(leadSourceFromUrl('https://acme.de/')).toBe('Website homepage');
  });
});

describe('ContactPersistenceService.saveContacts', () => {
  it('saves every contact with honest email fields', async () => {
    const { service, repository } = buildService();

    const result = await service.saveContacts({
      workspaceId: 'ws',
      companyId: 'company-1',
      defaultLeadSource: 'Ask AI',
      contacts: [
        {
          firstName: 'Jana',
          lastName: 'Fischer',
          email: 'jana@acme.de',
          emailStatus: 'found',
        },
        {
          firstName: 'Tom',
          lastName: 'Braun',
          email: 'tom@acme.de',
          emailStatus: 'guessed',
        },
        {
          firstName: 'Ann',
          lastName: 'Poe',
          email: 'ann@acme.de',
          emailStatus: 'verified',
        },
        {
          firstName: 'Bad',
          lastName: 'Mail',
          email: 'bad@acme.de',
          emailStatus: 'invalid',
        },
      ],
    });

    const records = insertedRecords(repository);

    expect(records.map((record) => record.emails?.primaryEmail)).toEqual([
      'jana@acme.de',
      undefined,
      'ann@acme.de',
      undefined,
    ]);
    expect(records.map((record) => record.emailStatus)).toEqual([
      'FOUND',
      'GUESSED',
      'VERIFIED',
      'INVALID',
    ]);
    expect(records.map((record) => record.position)).toEqual([6, 7, 8, 9]);
    expect(records.every((record) => record.leadSource === 'Ask AI')).toBe(
      true,
    );
    expect(result.created).toBe(4);
    expect(result.people[1]).toEqual(
      expect.objectContaining({
        id: 'person-1',
        name: 'Tom Braun',
        email: 'tom@acme.de',
        emailStatus: 'guessed',
        saved: true,
      }),
    );
  });

  it('skips people whose email or name already exists', async () => {
    const { service, repository } = buildService({
      byEmail: [
        {
          emails: {
            primaryEmail: 'other@acme.de',
            additionalEmails: ['jana@acme.de'],
          },
        },
      ],
      byCompany: [{ name: { firstName: 'Tom', lastName: 'Braun' } }],
    });

    const result = await service.saveContacts({
      workspaceId: 'ws',
      companyId: 'company-1',
      defaultLeadSource: 'Website',
      contacts: [
        {
          firstName: 'Jana',
          lastName: 'Fischer',
          email: 'JANA@acme.de',
          emailStatus: 'found',
        },
        { firstName: 'tom', lastName: 'braun' },
        { firstName: 'Lisa', lastName: 'Kurz' },
        { firstName: 'Lisa', lastName: 'Kurz' },
      ],
    });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(3);
    expect(result.people.map((person) => person.reason)).toEqual([
      'A person with this email already exists',
      'A person with this name already exists at this company',
      undefined,
      'A person with this name already exists at this company',
    ]);
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('does not match names across companies when no company is given', async () => {
    const { service, repository } = buildService();

    await service.saveContacts({
      workspaceId: 'ws',
      defaultLeadSource: 'Ask AI',
      contacts: [{ firstName: 'Lisa' }, { firstName: 'Lisa' }],
    });

    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.insert).toHaveBeenCalledTimes(2);
  });
});

describe('ContactPersistenceService.discoverAndSaveForCompanyIds', () => {
  it('saves discovered people per company and reports discovery failures', async () => {
    const { service, repository } = buildService({
      discovered: [
        {
          companyId: 'company-1',
          companyName: 'Acme',
          status: 'ok',
          people: [
            {
              firstName: 'Jana',
              lastName: 'Fischer',
              fullName: 'Jana Fischer',
              jobTitle: 'CEO',
              email: 'jana@acme.de',
              emailStatus: 'found',
              sourceUrl: 'https://acme.de/impressum',
              method: 'impressum',
            },
          ],
        },
        {
          companyId: 'company-2',
          companyName: 'Nowhere',
          status: 'no-website',
        },
      ],
    });

    const results = await service.discoverAndSaveForCompanyIds('ws', [
      'company-1',
      'company-2',
    ]);

    expect(results[0]).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        companyName: 'Acme',
        created: 1,
        skipped: 0,
      }),
    );
    expect(results[1]).toEqual({
      companyId: 'company-2',
      companyName: 'Nowhere',
      created: 0,
      skipped: 0,
      people: [],
      error: 'Company has no website',
    });
    expect(insertedRecords(repository)[0]).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        leadSource: 'Impressum',
        jobTitle: 'CEO',
      }),
    );
  });
});
