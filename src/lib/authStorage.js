/**
 * Persists Supabase auth tokens in the browser/Electron renderer localStorage
 * so users stay signed in after closing and reopening the app.
 */
export const authStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked — session won't persist
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
