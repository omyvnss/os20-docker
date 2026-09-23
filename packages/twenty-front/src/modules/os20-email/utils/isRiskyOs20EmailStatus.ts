import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';

export const isRiskyOs20EmailStatus = (
  status: Os20EmailStatus | null,
): boolean => status === 'GUESSED' || status === 'INVALID';
