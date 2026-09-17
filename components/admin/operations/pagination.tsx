import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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

/**
 * Prev/next and a page count, the one pattern every admin grid past a
 * handful of rows shares. Hidden entirely at one page, so an empty or
 * short demo list never shows a pager with nothing to do.
 */
export function Pagination({
  page,
  totalPages,
  total,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  /** Rows in the full (unpaginated) list, for the "X of Y" count. */
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-card px-4 py-3 shadow-soft"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} <span className="hidden sm:inline">· {total} total</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label="Previous page" className={iconButton('light')}>
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" className={cn(iconButton('light'), 'pointer-events-none opacity-40')}>
            <ChevronLeftIcon className="size-4" />
          </span>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} aria-label="Next page" className={iconButton('light')}>
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" className={cn(iconButton('light'), 'pointer-events-none opacity-40')}>
            <ChevronRightIcon className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
