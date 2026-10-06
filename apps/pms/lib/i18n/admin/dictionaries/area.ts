import type { AdminLocale } from '../locale';

/**
 * One screen area's strings in every admin language. English is the source
 * the other two are checked against: `K` is inferred from `en`, so a key
 * missing from `de` or `ru` — or one they have that `en` does not — is a
 * type error, not a silent English fallback at runtime.
 *
 * Areas are separate files so a screen's strings live next to nothing else
 * and two people can translate two screens without touching the same file;
 * `index.ts` merges them. Values may carry `{placeholders}` filled by `t()`.
 */
export type AreaDictionary<K extends string> = Record<AdminLocale, Record<K, string>>;

export function defineArea<K extends string>(area: AreaDictionary<K>): AreaDictionary<K> {
  return area;
}
