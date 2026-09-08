/**
 * Day and night, and the visitor's own choice between them.
 *
 * The tokens for both live in `app/globals.css`; all a theme is here is
 * whether `.dark` sits on `<html>`. Day is the default a first-time visitor
 * gets; `system` is offered for people who have told their OS which one
 * they want.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'spark.theme';
export const DEFAULT_THEME: ThemePreference = 'light';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(preference) === 'dark');
}

export function storeTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private window or blocked site data: the choice holds for this page only.
  }
}

/**
 * Runs in `<head>`, before the first paint, so a visitor who chose day does
 * not get a black screen for a frame first. Kept as one small string rather
 * than a module because it has to execute before anything is downloaded.
 */
export const THEME_BOOTSTRAP = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p!=='light'&&p!=='dark'&&p!=='system')p='${DEFAULT_THEME}';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
