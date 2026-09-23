import { LEAD_SEARCH_STEPS } from '@/os20-leads/constants/LeadSearchSteps';
import { getActiveLeadSearchStep } from '@/os20-leads/utils/getActiveLeadSearchStep';

const steps = LEAD_SEARCH_STEPS.map((step, index) => ({
  ...step,
  durationMs: index === LEAD_SEARCH_STEPS.length - 1 ? 0 : 1000,
}));

describe('getActiveLeadSearchStep', () => {
  it('advances one step per duration', () => {
    expect(getActiveLeadSearchStep(steps, 0)).toBe(0);
    expect(getActiveLeadSearchStep(steps, 999)).toBe(0);
    expect(getActiveLeadSearchStep(steps, 1000)).toBe(1);
    expect(getActiveLeadSearchStep(steps, 2500)).toBe(2);
  });

  it('holds on the last step until the request finishes', () => {
    expect(getActiveLeadSearchStep(steps, 60_000)).toBe(steps.length - 1);
  });
});
