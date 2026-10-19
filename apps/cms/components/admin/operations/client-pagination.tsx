'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, pageWindow } from './pagination-shared';

/** Rows per page for a client-held list — same default as the server-paginated grids' own `PAGE_SIZE`. Widened to `number` so a caller's own `useState` isn't pinned to the narrow `PageSizeOption` union. */
export const CLIENT_PAGE_SIZE: number = DEFAULT_PAGE_SIZE;

/** `paginate` from `pagination.tsx`, minus the server-only file it lives in — a client component holding its own array (an invite modal's local additions, say) can't page it with `?page=` in the URL, since nothing here is ever posted back to the server. */
export function paginateClient<T>(items: T[], page: number, pageSize: number = CLIENT_PAGE_SIZE): { pageItems: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), page: current, totalPages };
}

/**
 * `Pagination`'s own look (`components/admin/operations/pagination.tsx`),
 * as buttons instead of `?page=` links, for a grid a client component holds
 * in state rather than one a server page slices per request.
 */
export function ClientPagination({
  page,
  totalPages,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  onPageSizeChange,
  attached,
}: {
  page: number;
  totalPages: number;
  total: number;
  /** Rows per page this list is currently showing — only meaningful with `onPageSizeChange`. */
  pageSize?: number;
  onPageChange: (page: number) => void;
  /** Omit on a list whose page size is fixed — no "Show N per page" picker shows without it. */
  onPageSizeChange?: (pageSize: number) => void;
  attached?: boolean;
}) {
  const t = useAdminT();
  if (totalPages <= 1 && !onPageSizeChange) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label={t('ops.pagination')}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 py-3 pl-4 pr-24',
        attached ? 'border-t border-border' : 'mt-4 rounded-[18px] bg-card shadow-soft',
      )}
    >
      {onPageSizeChange ? (
        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span>{t('ops.show')}</span>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                aria-current={size === pageSize ? 'page' : undefined}
                aria-label={t('ops.showNPerPage', { count: size })}
                className={cn(
                  'flex min-h-7 cursor-pointer items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors',
                  size === pageSize
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                )}
              >
                {size}
              </button>
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
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t('ops.previousPage')}
          className={cn(iconButton('light', 'size-8'), 'disabled:pointer-events-none disabled:opacity-40')}
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((item, index) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={t('ops.pageOf', { page: item, total: totalPages })}
                className={cn(
                  'flex size-8 cursor-pointer items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors',
                  item === page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                )}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t('ops.nextPage')}
          className={cn(iconButton('light', 'size-8'), 'disabled:pointer-events-none disabled:opacity-40')}
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
