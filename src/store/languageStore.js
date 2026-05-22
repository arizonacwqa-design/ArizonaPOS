import { create } from 'zustand';

const KEY = 'acw_language';

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'ar') return v;
  } catch {}
  return 'en';
}

function apply(lang) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('lang', lang);
  if (lang === 'ar') {
    root.setAttribute('dir', 'rtl');
  } else {
    root.setAttribute('dir', 'ltr');
  }
}

// Make sure it runs on start
apply(readStored());

export const useLanguageStore = create((set, get) => ({
  language: readStored(),
  setLanguage: (language) => {
    apply(language);
    try { localStorage.setItem(KEY, language); } catch {}
    set({ language });
  },
}));
