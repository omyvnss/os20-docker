import { summarizeContactsResults } from '@/os20-contacts/utils/summarizeContactsResults';

describe('summarizeContactsResults', () => {
  it('adds up created, skipped and failed companies', () => {
    expect(
      summarizeContactsResults([
        {
          companyId: 'a',
          companyName: 'A',
          created: 2,
          skipped: 1,
          people: [],
        },
        {
          companyId: 'b',
          companyName: 'B',
          created: 3,
          skipped: 0,
          people: [],
        },
        {
          companyId: 'c',
          companyName: 'C',
          created: 0,
          skipped: 0,
          people: [],
          error: 'Timed out',
        },
      ]),
    ).toEqual({
      companyCount: 3,
      failedCompanyCount: 1,
      createdCount: 5,
      skippedCount: 1,
    });
  });

  it('returns zeros for no results', () => {
    expect(summarizeContactsResults([])).toEqual({
      companyCount: 0,
      failedCompanyCount: 0,
      createdCount: 0,
      skippedCount: 0,
    });
  });
});
