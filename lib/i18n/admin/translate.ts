import { ADMIN_DICTIONARIES, type AdminTranslationKey } from './dictionaries';
import type { AdminLocale } from './locale';

export type AdminVars = Record<string, string | number>;

/** `t('bell.reservationsNew', { count })` — the one function both the server (`getAdminT`) and the client (`useAdminT`) hand out. */
export type AdminT = (key: AdminTranslationKey, vars?: AdminVars) => string;

function interpolate(template: string, vars?: AdminVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Pure and synchronous, so a server component, a server action, a client
 * component and a test all translate the same way. Falls back to English
 * (never to the raw key) — the area files' types make a missing key a compile
 * error, so this is belt and braces, not a path anything should take.
 */
export function translateAdmin(locale: AdminLocale, key: AdminTranslationKey, vars?: AdminVars): string {
  const template = ADMIN_DICTIONARIES[locale][key] ?? ADMIN_DICTIONARIES.en[key];
  return interpolate(template, vars);
}

export function adminT(locale: AdminLocale): AdminT {
  return (key, vars) => translateAdmin(locale, key, vars);
}

/** Every admin page's `<title>`: the screen, then which product this is. */
export function adminPageTitle(t: AdminT, screen: string): string {
  return `${screen} — ${t('page.hotelAdmin')} | SPARK StaySphere 360`;
}
