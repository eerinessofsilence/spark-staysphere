import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getAdminT } from '@/lib/i18n/admin/server';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

/** Rows per admin grid — big enough that most demo lists never need a second page, small enough that a seeded one does. */
export const PAGE_SIZE = 20;

/** `?page=` as a whole number of 1 or more; anything else falls back to the first page. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Slices `items` to one page, clamping a page number past the end back to the last real page. */
export function paginate<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): { pageItems: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), page: current, totalPages };
}

/** A `Pagination` `hrefFor` for a page with no other query params to preserve. */
export function simplePageHref(basePath: string): (page: number) => string {
  return (page) => (page > 1 ? `${basePath}?page=${page}` : basePath);
}

/**
 * Prev/next and a page count, the one pattern every admin grid past a
 * handful of rows shares. Hidden entirely at one page, so an empty or
 * short demo list never shows a pager with nothing to do. A server
 * component that reads the team member's language itself, so every grid
 * (this area's and the CMS's) renders it without passing anything through.
 *
 * `attached`: a footer bar sharing its grid's own card — no gap, no rounding
 * or shadow of its own, just a hairline above it — rather than a second
 * card floating below the first. The caller wraps both in one
 * `overflow-hidden rounded-[18px] bg-card shadow-soft` and passes `attached`
 * to this and to `TableCard`.
 */
export async function Pagination({
  page,
  totalPages,
  total,
  hrefFor,
  attached,
}: {
  page: number;
  totalPages: number;
  /** Rows in the full (unpaginated) list, for the "X of Y" count. */
  total: number;
  hrefFor: (page: number) => string;
  attached?: boolean;
}) {
  if (totalPages <= 1) return null;
  const t = await getAdminT();
  return (
    <nav
      aria-label={t('ops.pagination')}
      className={cn(
        // `pr-24`, not `px-4` symmetric: the admin assistant's launcher is a
        // fixed circle pinned to the viewport's own bottom-right, not the
        // page's — at `sm` and up it sits 24px in and 64px across, a 88px
        // no-go strip along the right edge at any scroll position. A
        // right-aligned "next page" arrow sitting exactly there is
        // untappable, not just visually crowded.
        'flex flex-wrap items-center justify-between gap-3 py-3 pl-4 pr-24',
        attached ? 'border-t border-border' : 'mt-4 rounded-[18px] bg-card shadow-soft',
      )}
    >
      <p className="text-sm text-muted-foreground">
        {t('ops.pageOf', { page, total: totalPages })}{' '}
        <span className="hidden sm:inline">{t('ops.totalRows', { count: total })}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label={t('ops.previousPage')} className={iconButton('light')}>
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-label={t('ops.previousPage')}
            className={cn(iconButton('light'), 'disabled:pointer-events-none disabled:opacity-40')}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </button>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} aria-label={t('ops.nextPage')} className={iconButton('light')}>
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-label={t('ops.nextPage')}
            className={cn(iconButton('light'), 'disabled:pointer-events-none disabled:opacity-40')}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}
