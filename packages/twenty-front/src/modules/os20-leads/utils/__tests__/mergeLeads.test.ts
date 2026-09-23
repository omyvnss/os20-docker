import { buildTestLead } from '@/os20-leads/testing/buildTestLead';
import { getLeadKey } from '@/os20-leads/utils/getLeadKey';
import { mergeLeads } from '@/os20-leads/utils/mergeLeads';

describe('mergeLeads', () => {
  it('replaces leads with the same key and keeps the rest', () => {
    const old = buildTestLead({ id: 'a', score: 10 });
    const other = buildTestLead({ id: 'b', domain: 'globex.io' });
    const updated = buildTestLead({ id: 'c', score: 90 });

    expect(mergeLeads([old, other], [updated])).toEqual([updated, other]);
  });

  it('keys leads without a website by place id', () => {
    const place = buildTestLead({
      domain: undefined,
      companyUrl: '',
      externalId: 'place-1',
    });

    expect(getLeadKey(place)).toBe('place-1');
  });
});
