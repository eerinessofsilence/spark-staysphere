/**
 * The bits `pagination.tsx` (server, `?page=` links) and `client-pagination.tsx`
 * (client, local state) both need — kept framework-free so either can import it
 * without pulling in the other's server/client boundary.
 */

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSizeOption = 10;

export function isPageSizeOption(value: number): value is PageSizeOption {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

/**
 * First, last, and one page either side of the current one — everything
 * else collapses to a single `'ellipsis'`, the common numbered-pager shape.
 * With few enough pages there is no gap to collapse, so every page shows.
 */
export function pageWindow(current: number, total: number): (number | 'ellipsis')[] {
  const keep = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  let previous = 0;
  for (const page of keep) {
    if (previous && page - previous > 1) result.push('ellipsis');
    result.push(page);
    previous = page;
  }
  return result;
}
