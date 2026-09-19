'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

/** Rows per page for a client-held list — same default as the server-paginated grids' own `PAGE_SIZE`. */
export const CLIENT_PAGE_SIZE = 20;

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
  onPageChange,
  attached,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  attached?: boolean;
}) {
  const t = useAdminT();
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={t('ops.pagination')}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 py-3 pl-4 pr-24',
        attached ? 'border-t border-border' : 'mt-4 rounded-[18px] bg-card shadow-soft',
      )}
    >
      <p className="text-sm text-muted-foreground">
        {t('ops.pageOf', { page, total: totalPages })}{' '}
        <span className="hidden sm:inline">{t('ops.totalRows', { count: total })}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t('ops.previousPage')}
          className={cn(iconButton('light'), 'disabled:pointer-events-none disabled:opacity-40')}
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t('ops.nextPage')}
          className={cn(iconButton('light'), 'disabled:pointer-events-none disabled:opacity-40')}
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
