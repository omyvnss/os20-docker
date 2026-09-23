import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

export type LeadSearchStep = {
  label: MessageDescriptor;
  durationMs: number;
};

export const LEAD_SEARCH_STEPS: LeadSearchStep[] = [
  { label: msg`Searching sources`, durationMs: 6000 },
  { label: msg`Reading websites`, durationMs: 15000 },
  { label: msg`Scoring with AI`, durationMs: 12000 },
  { label: msg`Saving`, durationMs: 0 },
];
