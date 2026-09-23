import { buildTestLead } from '@/os20-leads/testing/buildTestLead';
import { splitLeadsByExistingDomains } from '@/os20-leads/utils/splitLeadsByExistingDomains';

describe('splitLeadsByExistingDomains', () => {
  it('skips leads whose domain is already a company', () => {
    const existing = buildTestLead({ id: 'a', domain: 'acme.com' });
    const fresh = buildTestLead({
      id: 'b',
      company: 'Globex',
      domain: undefined,
      companyUrl: 'https://globex.io',
    });

    const result = splitLeadsByExistingDomains(
      [existing, fresh],
      ['https://www.acme.com/'],
    );

    expect(result.toCreate).toEqual([fresh]);
    expect(result.duplicates).toEqual([existing]);
  });

  it('dedupes repeats inside the batch, by name when there is no domain', () => {
    const first = buildTestLead({ id: 'a' });
    const repeat = buildTestLead({ id: 'b', companyUrl: 'https://acme.com' });
    const noSite = buildTestLead({
      id: 'c',
      company: 'Corner Cafe',
      domain: undefined,
      companyUrl: '',
    });
    const noSiteRepeat = buildTestLead({
      id: 'd',
      company: ' corner cafe ',
      domain: undefined,
      companyUrl: '',
    });

    const result = splitLeadsByExistingDomains(
      [first, repeat, noSite, noSiteRepeat],
      [],
    );

    expect(result.toCreate.map((lead) => lead.id)).toEqual(['a', 'c']);
    expect(result.duplicates.map((lead) => lead.id)).toEqual(['b', 'd']);
  });
});
