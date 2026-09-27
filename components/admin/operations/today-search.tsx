'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { SearchInput } from '@/components/ui/search-input';

/**
 * The search box over the dashboard's "Today" lanes. The lanes are rendered
 * on the server; each row carries `data-search` (guest, room, reference,
 * lower-cased) and this hides the rows that do not match, so the three
 * lists stay one list each rather than a second, filtered copy. Empty
 * lanes are left alone — their "Nobody" line is not a row.
 */
export function TodaySearch({ target }: { target: string }) {
  const t = useAdminT();
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    const root = document.getElementById(target);
    if (!root) return;
    const needle = query.trim().toLowerCase();
    for (const row of root.querySelectorAll<HTMLElement>('[data-search]')) {
      row.hidden = needle !== '' && !(row.dataset.search ?? '').includes(needle);
    }
  }, [query, target]);

  return (
    <SearchInput
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={t('dashboard.searchToday')}
      aria-label={t('dashboard.searchToday')}
      wrapperClassName="w-full sm:w-64"
      className="min-h-10"
    />
  );
}
