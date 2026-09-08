/**
 * Which bookings this browser has made or claimed.
 *
 * There is no account yet (see CLAUDE.md), so "my trips" cannot mean "the
 * signed-in guest's". It means the references this browser holds: written on
 * the confirmation page, and added to by the claim form when a guest opens
 * the site somewhere else. The server still decides what a reference may
 * show — this list is only which ones to ask about.
 */

const STORAGE_KEY = 'spark.trips';
const LIMIT = 40;

function isReference(value: unknown): value is string {
  return typeof value === 'string' && /^AC-[A-Za-z0-9]{6}$/.test(value.trim());
}

/** Private windows and blocked site data throw rather than return empty. */
export function readTrips(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(isReference).map((entry) => entry.trim().toUpperCase()))].slice(
      0,
      LIMIT,
    );
  } catch {
    return [];
  }
}

/** Newest first, so a long history drops its oldest reference rather than the new one. */
export function rememberTrip(reference: string): string[] {
  if (!isReference(reference)) return readTrips();
  const next = [reference.trim().toUpperCase(), ...readTrips()];
  const unique = [...new Set(next)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  } catch {
    // Storage refused (private window, site data blocked). The trip is still
    // reachable by its reference; only this browser's memory of it is lost.
  }
  return unique;
}
