import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';

export type Os20SavedContact = {
  id?: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  emailStatus: Os20EmailStatus | null;
  saved: boolean;
  reason?: string;
};
