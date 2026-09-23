import { parseCompanyContactsResults } from '@/os20-contacts/utils/parseCompanyContactsResults';

describe('parseCompanyContactsResults', () => {
  it('parses results and normalizes contacts', () => {
    const results = parseCompanyContactsResults({
      success: true,
      results: [
        {
          companyId: 'c1',
          companyName: 'Acme',
          created: 2,
          skipped: 1,
          people: [
            {
              id: 'p1',
              name: 'Jane Doe',
              jobTitle: 'CEO',
              email: 'jane@acme.com',
              emailStatus: 'VERIFIED',
              saved: true,
            },
            {
              name: 'John Roe',
              jobTitle: '',
              email: 'john@acme.com',
              emailStatus: 'UNKNOWN',
              saved: false,
              reason: 'Already in People',
            },
          ],
        },
      ],
    });

    expect(results).toEqual([
      {
        companyId: 'c1',
        companyName: 'Acme',
        created: 2,
        skipped: 1,
        error: undefined,
        people: [
          {
            id: 'p1',
            name: 'Jane Doe',
            jobTitle: 'CEO',
            email: 'jane@acme.com',
            emailStatus: 'VERIFIED',
            saved: true,
            reason: undefined,
          },
          {
            id: undefined,
            name: 'John Roe',
            jobTitle: null,
            email: 'john@acme.com',
            emailStatus: null,
            saved: false,
            reason: 'Already in People',
          },
        ],
      },
    ]);
  });

  it('drops malformed entries and tolerates bad payloads', () => {
    expect(parseCompanyContactsResults(null)).toEqual([]);
    expect(parseCompanyContactsResults({ results: 'nope' })).toEqual([]);

    const [result] = parseCompanyContactsResults({
      results: [
        { companyName: 'No id' },
        {
          companyId: 'c2',
          created: -3,
          skipped: 'x',
          people: [{ name: '' }, null, { email: 'hi@globex.io' }],
          error: 'Site unreachable',
        },
      ],
    });

    expect(result.companyId).toBe('c2');
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.error).toBe('Site unreachable');
    expect(result.people.map((person) => person.name)).toEqual([
      'hi@globex.io',
    ]);
  });
});
