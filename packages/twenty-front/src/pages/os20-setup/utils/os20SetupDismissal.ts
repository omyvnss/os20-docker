const STORAGE_KEY = 'os20.setup.dismissed';

// Storage can be unavailable (private mode, blocked site data); treat that as
// "not dismissed" so the setup page's own key check decides.
export const isOs20SetupDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const dismissOs20Setup = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Nothing to persist; the setup page skips itself once a key exists.
  }
};
