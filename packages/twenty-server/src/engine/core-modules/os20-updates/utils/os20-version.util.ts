import semver from 'semver';

export const normalizeOs20Version = (
  version: string | null | undefined,
): string | null => {
  if (typeof version !== 'string') {
    return null;
  }

  const trimmed = version.trim().replace(/^v/i, '');

  return semver.valid(trimmed);
};

export const isNewerOs20Version = (
  latestVersion: string | null | undefined,
  currentVersion: string | null | undefined,
): boolean => {
  const latest = normalizeOs20Version(latestVersion);
  const current = normalizeOs20Version(currentVersion);

  if (latest === null || current === null) {
    return false;
  }

  if (semver.prerelease(latest) !== null) {
    return false;
  }

  return semver.gt(latest, current);
};
