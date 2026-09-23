import { getApiErrorMessage } from '@/os20-contacts/utils/getApiErrorMessage';

describe('getApiErrorMessage', () => {
  it('reads string and list messages', () => {
    expect(getApiErrorMessage({ message: ' No AI key ' })).toBe('No AI key');
    expect(
      getApiErrorMessage({ message: ['companyIds must be an array', 42] }),
    ).toBe('companyIds must be an array');
  });

  it('returns undefined when there is no usable message', () => {
    expect(getApiErrorMessage(null)).toBeUndefined();
    expect(getApiErrorMessage('oops')).toBeUndefined();
    expect(getApiErrorMessage({ message: '' })).toBeUndefined();
    expect(getApiErrorMessage({ message: [] })).toBeUndefined();
  });
});
