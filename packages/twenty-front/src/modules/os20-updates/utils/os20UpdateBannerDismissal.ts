import { type Os20UpdateStatus } from '@/os20-updates/types/Os20UpdateStatus';

export const OS20_UPDATE_DISMISSED_VERSION_KEY =
  'os20.updateBanner.dismissedVersion';

export const OS20_UPDATE_COMMAND = 'npx os20-cli update';

export const readDismissedOs20UpdateVersion = (): string | null => {
  try {
    return window.localStorage.getItem(OS20_UPDATE_DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
};

export const writeDismissedOs20UpdateVersion = (version: string) => {
  try {
    window.localStorage.setItem(OS20_UPDATE_DISMISSED_VERSION_KEY, version);
  } catch {
    return;
  }
};

export const shouldShowOs20UpdateBanner = (
  status: Os20UpdateStatus | null,
  dismissedVersion: string | null,
): boolean =>
  status !== null &&
  status.updateAvailable &&
  typeof status.latestVersion === 'string' &&
  status.latestVersion !== dismissedVersion;
