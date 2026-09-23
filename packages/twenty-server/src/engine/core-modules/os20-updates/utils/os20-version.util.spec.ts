import {
  isNewerOs20Version,
  normalizeOs20Version,
} from 'src/engine/core-modules/os20-updates/utils/os20-version.util';

describe('normalizeOs20Version', () => {
  it('strips a leading v and whitespace', () => {
    expect(normalizeOs20Version(' v2.37.0 ')).toBe('2.37.0');
    expect(normalizeOs20Version('V2.37.0')).toBe('2.37.0');
  });

  it('returns null for missing or invalid versions', () => {
    expect(normalizeOs20Version(undefined)).toBeNull();
    expect(normalizeOs20Version('')).toBeNull();
    expect(normalizeOs20Version('latest')).toBeNull();
  });
});

describe('isNewerOs20Version', () => {
  it('compares numerically, not lexically', () => {
    expect(isNewerOs20Version('v2.10.0', '2.9.0')).toBe(true);
    expect(isNewerOs20Version('2.9.0', '2.10.0')).toBe(false);
  });

  it('is false for equal or older versions', () => {
    expect(isNewerOs20Version('v2.37.0', '2.37.0')).toBe(false);
    expect(isNewerOs20Version('v2.36.1', '2.37.0')).toBe(false);
  });

  it('treats a prerelease as not newer', () => {
    expect(isNewerOs20Version('v2.38.0-beta.1', '2.37.0')).toBe(false);
  });

  it('is newer than a running prerelease once the stable ships', () => {
    expect(isNewerOs20Version('v2.37.0', '2.37.0-rc.1')).toBe(true);
  });

  it('is false when either side is unknown', () => {
    expect(isNewerOs20Version(null, '2.37.0')).toBe(false);
    expect(isNewerOs20Version('v2.38.0', null)).toBe(false);
  });
});
