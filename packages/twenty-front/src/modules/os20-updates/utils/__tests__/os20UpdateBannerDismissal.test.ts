import { type Os20UpdateStatus } from '@/os20-updates/types/Os20UpdateStatus';
import {
  OS20_UPDATE_DISMISSED_VERSION_KEY,
  readDismissedOs20UpdateVersion,
  shouldShowOs20UpdateBanner,
  writeDismissedOs20UpdateVersion,
} from '@/os20-updates/utils/os20UpdateBannerDismissal';

const status = (
  overrides: Partial<Os20UpdateStatus> = {},
): Os20UpdateStatus => ({
  currentVersion: '2.37.0',
  latestVersion: '2.38.0',
  updateAvailable: true,
  releaseNotesUrl: 'https://github.com/omyvnss/os20/releases/tag/v2.38.0',
  checkedAt: '2026-09-22T00:00:00.000Z',
  checkEnabled: true,
  ...overrides,
});

describe('shouldShowOs20UpdateBanner', () => {
  it('shows when an update is available and not dismissed', () => {
    expect(shouldShowOs20UpdateBanner(status(), null)).toBe(true);
  });

  it('hides when the status is unknown or no update is available', () => {
    expect(shouldShowOs20UpdateBanner(null, null)).toBe(false);
    expect(
      shouldShowOs20UpdateBanner(status({ updateAvailable: false }), null),
    ).toBe(false);
  });

  it('hides only for the dismissed version', () => {
    expect(shouldShowOs20UpdateBanner(status(), '2.38.0')).toBe(false);
    expect(
      shouldShowOs20UpdateBanner(status({ latestVersion: '2.39.0' }), '2.38.0'),
    ).toBe(true);
  });
});

describe('dismissed version storage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it('round-trips the dismissed version', () => {
    writeDismissedOs20UpdateVersion('2.38.0');

    expect(window.localStorage.getItem(OS20_UPDATE_DISMISSED_VERSION_KEY)).toBe(
      '2.38.0',
    );
    expect(readDismissedOs20UpdateVersion()).toBe('2.38.0');
  });

  it('survives a storage that throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => writeDismissedOs20UpdateVersion('2.38.0')).not.toThrow();
    expect(readDismissedOs20UpdateVersion()).toBeNull();
  });
});
