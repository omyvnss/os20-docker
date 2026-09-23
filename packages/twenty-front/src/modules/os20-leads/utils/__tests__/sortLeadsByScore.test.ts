import { buildTestLead } from '@/os20-leads/testing/buildTestLead';
import { sortLeadsByScore } from '@/os20-leads/utils/sortLeadsByScore';

describe('sortLeadsByScore', () => {
  it('orders by score descending, then by name', () => {
    const leads = [
      buildTestLead({ company: 'Low', score: 10 }),
      buildTestLead({ company: 'Beta', score: 80 }),
      buildTestLead({ company: 'Alpha', score: 80 }),
    ];

    expect(sortLeadsByScore(leads).map((lead) => lead.company)).toEqual([
      'Alpha',
      'Beta',
      'Low',
    ]);
  });

  it('does not mutate the input', () => {
    const leads = [buildTestLead({ score: 1 }), buildTestLead({ score: 2 })];

    sortLeadsByScore(leads);

    expect(leads[0].score).toBe(1);
  });
});
