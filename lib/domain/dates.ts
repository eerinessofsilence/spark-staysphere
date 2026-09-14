import { addDays, format, parseISO } from 'date-fns';

/**
 * `iso` shifted by `days` calendar days, formatted back to `yyyy-MM-dd`.
 * Shared by the tape chart's own segment math (`inventory-service.ts`), its
 * grid's day-column paging, and its page's prev/next week controls, so the
 * same operation isn't three separate copies.
 */
export function addIsoDays(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
}
