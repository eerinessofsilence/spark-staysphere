/**
 * The languages `LanguagePicker` offers. Adding one means: a row here, a
 * dictionary in `lib/i18n/dictionaries`, and — if it needs its own calendar
 * month/weekday names — an entry in `DATE_FNS_LOCALES` (`format.ts`).
 */
export const LOCALES = ['en', 'ru', 'hr', 'de', 'fr', 'it', 'es', 'pl'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Same key `LanguagePicker` already wrote to before this module existed —
 * kept so a browser that already picked a language keeps it rather than
 * silently resetting to English.
 */
export const LOCALE_STORAGE_KEY = 'staysphere:locale';

/** BCP-47 tags for `Intl.NumberFormat`/`Intl.DateTimeFormat` — digit grouping and separators, not the currency symbol (that stays EUR/the booking's own currency regardless of locale). */
export const INTL_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  ru: 'ru-RU',
  hr: 'hr-HR',
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT',
  es: 'es-ES',
  pl: 'pl-PL',
};
