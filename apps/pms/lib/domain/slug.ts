/** Kebab-case a free-text name — used both for the live slug suggestion in the CMS's "new room" form and by `content-service.ts`'s server-side validation, so the two can never disagree about what counts as kebab-case. */
export function kebabSuggestion(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
