import { normalizeDomain } from '@/os20-leads/utils/normalizeDomain';

describe('normalizeDomain', () => {
  it.each([
    ['https://www.Acme.com/about?x=1', 'acme.com'],
    ['http://shop.acme.co.uk:8080/', 'shop.acme.co.uk'],
    ['acme.com', 'acme.com'],
    ['www.acme.com.', 'acme.com'],
  ])('normalizes %p', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([undefined, null, '', '   ', 'localhost'])(
    'returns undefined for %p',
    (input) => {
      expect(normalizeDomain(input)).toBeUndefined();
    },
  );
});
