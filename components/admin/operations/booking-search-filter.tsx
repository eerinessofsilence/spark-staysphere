'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { SearchInput } from '@/components/ui/search-input';

/**
 * The reservations search, as a compact pill on a phone rather than an
 * always-open text field: the same trigger-then-modal shape as
 * `BookingDatesFilter`, so a phone screen shows one row of small controls
 * (Filters · Any dates · Search) instead of Search alone claiming a full
 * row for a field nobody is typing into yet. Desktop keeps the plain
 * always-visible input — see `page.tsx`, which hides this past `lg:`.
 */
export function BookingSearchFilter({ query }: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(query);

  // Each opening starts from what is applied, not from an abandoned draft.
  React.useEffect(() => {
    if (open) setDraft(query);
  }, [open, query]);

  function navigate(next: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next.trim()) params.set('q', next.trim());
    else params.delete('q');
    const search = params.toString();
    router.push(search ? `${pathname}?${search}` : pathname);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setOpen(false);
    navigate(draft);
  }

  return (
    <div className="flex items-center gap-1 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={query ? t('ops.searchChange', { query }) : t('ops.searchReservations')}
        className={cn(
          'inline-flex min-h-11 max-w-40 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
          query
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-foreground hover:bg-stone',
        )}
      >
        <MagnifyingGlassIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{query || t('ops.search')}</span>
      </button>
      {query ? (
        <button type="button" onClick={() => navigate('')} aria-label={t('ops.clearSearch')} className={iconButton('light')}>
          <XMarkIcon className="size-4" aria-hidden="true" />
        </button>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title={t('ops.searchReservations')}>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="bookings-search-mobile" className="sr-only">
            {t('ops.searchLabel')}
          </label>
          <SearchInput
            id="bookings-search-mobile"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('ops.searchPlaceholder')}
            wrapperClassName="flex-1"
          />
          <button type="submit" className={pill('primary')}>
            {t('ops.search')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
