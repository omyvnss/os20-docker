import { type ThemeColor } from 'twenty-ui/theme';

import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';

export const OS20_EMAIL_STATUS_COLORS: Record<Os20EmailStatus, ThemeColor> = {
  VERIFIED: 'green',
  FOUND: 'blue',
  GUESSED: 'orange',
  INVALID: 'red',
};
