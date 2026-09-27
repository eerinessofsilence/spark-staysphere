'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';

/**
 * Always visible, unlike `BookingSearchFilter`'s modal-behind-a-pill: this
 * screen is dense with numbers already, but has room across the top for a
 * plain field the way the row it's replacing (a static "Room type" head)
 * never needed one. Filters room types and rate names alike — see
 * `page.tsx`'s own match against `q`.
 */
export function RatesSearchBox({ query }: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useAdminT();
  const [draft, setDraft] = React.useState(query);

  React.useEffect(() => setDraft(query), [query]);

  function navigate(next: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next.trim()) params.set('q', next.trim());
    else params.delete('q');
    params.delete('page');
    const search = params.toString();
    router.push(search ? `${pathname}?${search}` : pathname);
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(draft);
      }}
      className="relative w-full sm:max-w-xs"
    >
      <label htmlFor="rates-search" className="sr-only">
        {t('rates.search')}
      </label>
      <SearchInput
        id="rates-search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t('rates.searchPlaceholder')}
        className={cn(query && 'pr-11')}
      />
      {query ? (
        <button
          type="button"
          onClick={() => navigate('')}
          aria-label={t('rates.clearSearch')}
          className={cn(iconButton('light', 'size-8'), 'absolute top-1/2 right-1.5 -translate-y-1/2')}
        >
          <XMarkIcon className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}
