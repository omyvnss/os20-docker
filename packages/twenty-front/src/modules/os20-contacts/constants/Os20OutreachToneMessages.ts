import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';

import { type Os20OutreachTone } from '@/os20-contacts/types/Os20OutreachTone';

export const OS20_OUTREACH_TONE_MESSAGES: Record<
  Os20OutreachTone,
  MessageDescriptor
> = {
  short: msg`Short`,
  friendly: msg`Friendly`,
  formal: msg`Formal`,
};
