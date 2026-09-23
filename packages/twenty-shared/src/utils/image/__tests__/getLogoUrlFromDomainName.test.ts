import {
  getLogoUrlFromDomainName,
  sanitizeURL,
} from '@/utils/image/getLogoUrlFromDomainName';

describe('sanitizeURL', () => {
  test('should sanitize the URL correctly', () => {
    expect(sanitizeURL('http://example.com/')).toBe('example.com');
    expect(sanitizeURL('https://www.example.com/')).toBe('example.com');
    expect(sanitizeURL('www.example.com')).toBe('example.com');
    expect(sanitizeURL('example.com')).toBe('example.com');
    expect(sanitizeURL('example.com/')).toBe('example.com');
  });

  test('should handle undefined input', () => {
    expect(sanitizeURL(undefined)).toBe('');
  });
});

describe('getLogoUrlFromDomainName', () => {
  test('never builds a third-party logo URL', () => {
    expect(getLogoUrlFromDomainName('example.com')).toBeUndefined();
    expect(
      getLogoUrlFromDomainName('https://www.example.com/'),
    ).toBeUndefined();
    expect(getLogoUrlFromDomainName(undefined)).toBeUndefined();
  });
});
