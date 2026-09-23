import { type Os20SavedContact } from '@/os20-contacts/types/Os20SavedContact';

export type Os20CompanyContactsResult = {
  companyId: string;
  companyName: string;
  created: number;
  skipped: number;
  people: Os20SavedContact[];
  error?: string;
};
