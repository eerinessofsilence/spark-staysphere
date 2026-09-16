'use client';

import * as React from 'react';
import { DICTIONARIES, type TranslationKey } from './dictionaries';
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, type Locale } from './locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = React.createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

/**
 * The interface's language, for the whole guest site. Nothing here is known
 * to the server — there is no account, no cookie, no locale-prefixed route —
 * so every page renders English first (what the server can render without
 * guessing) and this corrects it after mount from whatever the browser
 * remembered, the same "default, then correct" shape `LanguagePicker` used
 * before this provider existed. `/admin` is not wrapped in this and stays
 * English — a hotel's back office, not the guest-facing site a picker like
 * this speaks for.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      // Storage blocked (private window, site data cleared): stay on English.
    }
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Not being able to remember it is not a reason to refuse the choice.
    }
  }, []);

  const value = React.useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return React.useContext(LocaleContext);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * `t('confirm.bookedOn', { date })` — looks the key up in the current
 * locale's dictionary, falling back to English (never to the raw key) if a
 * translation is somehow missing, and fills in any `{placeholder}`.
 */
export function useT(): (key: TranslationKey, vars?: Record<string, string | number>) => string {
  const { locale } = useLocale();
  return React.useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = DICTIONARIES[locale][key] ?? DICTIONARIES.en[key];
      return interpolate(template, vars);
    },
    [locale],
  );
}
