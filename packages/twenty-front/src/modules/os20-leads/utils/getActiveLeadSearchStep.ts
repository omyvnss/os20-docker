import { type LeadSearchStep } from '@/os20-leads/constants/LeadSearchSteps';

// The find endpoint is one request, so steps advance on elapsed time and the
// last step holds until the response arrives.
export const getActiveLeadSearchStep = (
  steps: LeadSearchStep[],
  elapsedMs: number,
): number => {
  let boundary = 0;

  for (let index = 0; index < steps.length - 1; index++) {
    boundary += steps[index].durationMs;

    if (elapsedMs < boundary) return index;
  }

  return steps.length - 1;
};
