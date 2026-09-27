import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getAdminT } from '@/lib/i18n/admin/server';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { DEFAULT_PAGE_SIZE, isPageSizeOption, PAGE_SIZE_OPTIONS, pageWindow } from './pagination-shared';

/** Rows per admin grid — big enough that most demo lists never need a second page, small enough that a seeded one does. */
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** `?page=` as a whole number of 1 or more; anything else falls back to the first page. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** `?pageSize=` as one of `PAGE_SIZE_OPTIONS`; anything else falls back to the default. */
export function parsePageSize(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const size = Number(raw);
  return isPageSizeOption(size) ? size : DEFAULT_PAGE_SIZE;
}

/** Slices `items` to one page, clamping a page number past the end back to the last real page. */
export function paginate<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): { pageItems: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), page: current, totalPages };
}

/** A `Pagination` `hrefFor` for a page with no other query params to preserve, at a given page size. */
export function simplePageHref(basePath: string, pageSize: number = DEFAULT_PAGE_SIZE): (page: number) => string {
  return (page) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(pageSize));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Everything one grid's footer needs, read from and written back to the
 * page's own query string: `key` namespaces the params (`${key}Page`,
 * `${key}PageSize`) so a page with several grids pages each on its own, and
 * every other param already in the URL — filters, tabs, another grid's page
 * — is carried through untouched. The one way a grid gets the same footer
 * as every other: page numbers, arrows, and "Show 10 / 20 / 50".
 */
export function tablePager(params: SearchParams, basePath: string, key = '') {
  const pageKey = key ? `${key}Page` : 'page';
  const sizeKey = key ? `${key}PageSize` : 'pageSize';
  const page = parsePage(params[pageKey]);
  const pageSize = parsePageSize(params[sizeKey]);
  const build = (overrides: Record<string, string | null>) => {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      if (value === undefined || name in overrides) continue;
      for (const item of Array.isArray(value) ? value : [value]) query.append(name, item);
    }
    for (const [name, value] of Object.entries(overrides)) if (value !== null) query.set(name, value);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return {
    page,
    pageSize,
    hrefFor: (next: number) => build({ [pageKey]: next > 1 ? String(next) : null }),
    pageSizeHrefFor: (size: number) => build({ [sizeKey]: size !== DEFAULT_PAGE_SIZE ? String(size) : null, [pageKey]: null }),
  };
}

/** A `Pagination` `pageSizeHrefFor` for a page with no other query params to preserve — always resets to page 1. */
export function simplePageSizeHref(basePath: string): (pageSize: number) => string {
  return (pageSize) => (pageSize === DEFAULT_PAGE_SIZE ? basePath : `${basePath}?pageSize=${pageSize}`);
}

/**
 * Prev/next, numbered pages, and a "Show N per page" size picker — the one
 * pattern every admin grid past a handful of rows shares. Hidden entirely
 * once a list can't even fill the smallest page size, so an empty or short
 * demo list never shows a pager with nothing to do. A server component that
 * reads the team member's language itself, so every grid renders it without
 * passing anything through.
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
  pageSize = DEFAULT_PAGE_SIZE,
  hrefFor,
  pageSizeHrefFor,
  attached,
  always = false,
}: {
  page: number;
  totalPages: number;
  /** Rows in the full (unpaginated) list, for the "1–10 of 52" count. */
  total: number;
  /** Rows per page this list is currently showing — only meaningful with `pageSizeHrefFor`. */
  pageSize?: number;
  hrefFor: (page: number) => string;
  /** Omit on a list whose page size is fixed — no "Show N per page" picker shows without it. */
  pageSizeHrefFor?: (pageSize: number) => string;
  attached?: boolean;
  /** Keep the footer on a one-page list too — a grid that always shows its count and arrows reads as the same grid whether it holds one row or fifty. */
  always?: boolean;
}) {
  if (totalPages <= 1 && !pageSizeHrefFor && !always) return null;
  const t = await getAdminT();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label={t('ops.pagination')}
      className={cn(
        // Symmetric with the table's own cell padding, so the arrows sit on
        // the card's edge like the last column does. The admin assistant's
        // fixed launcher lives in the viewport's bottom-right corner;
        // `AdminPage`'s bottom padding is what lets a footer scroll clear of it.
        'flex flex-wrap items-center justify-between gap-3 px-4 py-3',
        attached ? 'border-t border-border' : 'mt-4 rounded-[18px] bg-card shadow-soft',
      )}
    >
      {pageSizeHrefFor ? (
        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span>{t('ops.show')}</span>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <Link
                key={size}
                href={pageSizeHrefFor(size)}
                aria-current={size === pageSize ? 'page' : undefined}
                aria-label={t('ops.showNPerPage', { count: size })}
                className={cn(
                  'flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors',
                  size === pageSize
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                )}
              >
                {size}
              </Link>
            ))}
          </div>
          <span>{t('ops.perPage')}</span>
        </div>
      ) : (
        <span aria-hidden="true" />
      )}

      <div className="flex items-center gap-1">
        <p className="mr-1 hidden text-sm text-muted-foreground sm:block">
          {t('ops.rangeOfTotal', { from, to, total })}
        </p>
        <p className="text-sm text-muted-foreground sm:hidden">{t('ops.pageOf', { page, total: totalPages })}</p>
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label={t('ops.previousPage')} className={iconButton('light', 'size-8')}>
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-label={t('ops.previousPage')}
            className={cn(iconButton('light', 'size-8'), 'disabled:pointer-events-none disabled:opacity-40')}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </button>
        )}
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((item, index) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefFor(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={t('ops.pageOf', { page: item, total: totalPages })}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors',
                  item === page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                )}
              >
                {item}
              </Link>
            ),
          )}
        </div>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} aria-label={t('ops.nextPage')} className={iconButton('light', 'size-8')}>
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-label={t('ops.nextPage')}
            className={cn(iconButton('light', 'size-8'), 'disabled:pointer-events-none disabled:opacity-40')}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}
