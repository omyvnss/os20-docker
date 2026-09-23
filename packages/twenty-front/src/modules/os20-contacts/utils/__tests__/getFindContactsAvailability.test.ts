import { getFindContactsAvailability } from '@/os20-contacts/utils/getFindContactsAvailability';

describe('getFindContactsAvailability', () => {
  it('maps selection size to availability', () => {
    expect(getFindContactsAvailability(0)).toBe('none');
    expect(getFindContactsAvailability(1)).toBe('available');
    expect(getFindContactsAvailability(10)).toBe('available');
    expect(getFindContactsAvailability(11)).toBe('too-many');
  });
});
