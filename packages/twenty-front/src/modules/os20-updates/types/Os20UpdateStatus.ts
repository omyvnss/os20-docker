export type Os20UpdateStatus = {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseNotesUrl: string | null;
  checkedAt: string | null;
  checkEnabled: boolean;
};
