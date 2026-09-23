import { t } from '@lingui/core/macro';

import { type Os20UpdateStatus } from '@/os20-updates/types/Os20UpdateStatus';

export const getOs20UpdateStatusLabel = (
  status: Os20UpdateStatus | null,
  isLoaded: boolean,
): string => {
  if (!isLoaded) {
    return t`Checking for updates...`;
  }

  if (status === null) {
    return t`Version information is unavailable right now.`;
  }

  if (!status.checkEnabled) {
    return t`Update checks are turned off (OS20_UPDATE_CHECK=false).`;
  }

  if (status.updateAvailable && status.latestVersion !== null) {
    const latestVersion = status.latestVersion;

    return t`OS20 ${latestVersion} is available.`;
  }

  if (status.latestVersion === null) {
    return t`Could not reach GitHub to check for updates. OS20 will try again later.`;
  }

  return t`You are on the latest version.`;
};
