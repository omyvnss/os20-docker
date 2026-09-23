import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';

import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';

export const OS20_EMAIL_STATUS_MESSAGES: Record<
  Os20EmailStatus,
  { label: MessageDescriptor; description: MessageDescriptor }
> = {
  VERIFIED: {
    label: msg`Verified`,
    description: msg`The mail server accepted this address.`,
  },
  FOUND: {
    label: msg`Found`,
    description: msg`Shown on the company website.`,
  },
  GUESSED: {
    label: msg`Guessed`,
    description: msg`Built from the company's email pattern, not confirmed.`,
  },
  INVALID: {
    label: msg`Invalid`,
    description: msg`The mail server rejected this address.`,
  },
};
