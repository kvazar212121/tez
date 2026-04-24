import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translate } from './translations';

const STORAGE_KEY = 'taxi-free-ui-locale';

/** @type {import('./translations').AppLocale} */
const DEFAULT_LOCALE = 'uz';

const LocaleContext = createContext(null);

function readStoredLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'ru' || v === 'uz') return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);

  const setLocale = useCallback((next) => {
    const v = next === 'ru' ? 'ru' : 'uz';
    setLocaleState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === 'uz' ? 'ru' : 'uz';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'ru' ? 'ru' : 'uz';
  }, [locale]);

  const t = useCallback((key, vars) => translate(locale, key, vars), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      /** Interfeys O‘zbekcha bo‘lsa RU, ruscha bo‘lsa UZ ko‘rinadi */
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}

/** @returns {import('./translations').translate} */
export function useT() {
  return useLocale().t;
}
