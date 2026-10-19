/** Preserve a viewer link's filters when an optional query is supplied. */
export function withStayQuery(href: string, query?: string): string {
  if (!query) return href;
  const url = new URL(href, 'http://catalog.local');
  new URLSearchParams(query).forEach((value, key) => url.searchParams.set(key, value));
  return href.startsWith('/') ? url.pathname + url.search + url.hash : url.toString();
}
