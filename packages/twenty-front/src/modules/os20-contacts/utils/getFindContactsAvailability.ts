import { OS20_MAX_FIND_CONTACTS_COMPANIES } from '@/os20-contacts/constants/Os20MaxFindContactsCompanies';

export type FindContactsAvailability = 'none' | 'available' | 'too-many';

export const getFindContactsAvailability = (
  selectedCount: number,
): FindContactsAvailability => {
  if (selectedCount <= 0) return 'none';

  return selectedCount > OS20_MAX_FIND_CONTACTS_COMPANIES
    ? 'too-many'
    : 'available';
};
