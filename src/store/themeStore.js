import { create } from 'zustand';

const KEY = 'acw_theme';

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'dark';
}

function apply(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('theme-light');
    root.classList.remove('theme-dark');
  } else {
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
  }
}

// Make sure the very first render matches the stored preference, in case the
// inline boot script in index.html didn't run (e.g. during dev HMR).
apply(readStored());

export const useThemeStore = create((set, get) => ({
  theme: readStored(),
  setTheme: (theme) => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch {}
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));
