import { OS20_EMAIL_STATUSES } from '@/os20-contacts/constants/Os20EmailStatuses';
import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';

export const isOs20EmailStatus = (value: unknown): value is Os20EmailStatus =>
  typeof value === 'string' &&
  OS20_EMAIL_STATUSES.includes(value as Os20EmailStatus);
