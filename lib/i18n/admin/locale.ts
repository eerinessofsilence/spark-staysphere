import type { Locale } from '../locale';

/**
 * The back office's own languages — a subset of the guest site's, so every
 * `l*` formatter in `lib/i18n/format.ts` (dates, money, plurals, the catalog
 * vocabularies) already speaks them. The choice is the team member's, not
 * the browser's or the guest's: it lives in a cookie scoped to `/admin`
 * (`ADMIN_LOCALE_COOKIE`), read on the server so every screen renders in it
 * from the first byte — no English flash, unlike the guest picker, which has
 * no server-side state to read. Picked on `/admin/account`.
 */
export const ADMIN_LOCALES = ['en', 'de', 'ru'] as const satisfies readonly Locale[];

export type AdminLocale = (typeof ADMIN_LOCALES)[number];

export const DEFAULT_ADMIN_LOCALE: AdminLocale = 'en';

/** Scoped to `/admin`, like the selected-hotel cookie — the guest site never reads it. */
export const ADMIN_LOCALE_COOKIE = 'admin-locale';

export function isAdminLocale(value: unknown): value is AdminLocale {
  return typeof value === 'string' && (ADMIN_LOCALES as readonly string[]).includes(value);
}

/** Each language in its own words — a picker never translates the names of the languages it offers. */
export const ADMIN_LANGUAGE_NAME: Record<AdminLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
};

/**
 * One flag per language, for a quick visual scan in the picker — a stand-in
 * for the country most associated with it, not a claim that the language
 * belongs to that country alone (`en` picks the UK, the same region the
 * guest site's own `LanguagePicker` gives it).
 */
export const ADMIN_LANGUAGE_FLAG: Record<AdminLocale, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  ru: '🇷🇺',
};
