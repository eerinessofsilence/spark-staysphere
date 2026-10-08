'use client';

import * as React from 'react';
import { PreloaderLink as Link } from '@/components/ui/preloader-navigation';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface FilterPillOption {
  key: string;
  label: string;
  count: number;
  href: string;
  current: boolean;
}

/**
 * One row of counted filter pills over a grid — the stays on
 * `/admin/bookings`, the categories on `/admin/content/add-ons` — where each
 * option is a link, not a control, so the grid below is whatever the URL
 * says it is. Past four or five options they wrap into a cramped second row
 * on a phone, so below `lg` they move into a bottom sheet behind one
 * "Filters" button, the same pattern as the guest room filters.
 *
 * `label` and `sheetTitle` come from the page: the pills are shared, the
 * words over them are that screen's own.
 */
export function FilterPills({
  options,
  label,
  sheetTitle,
}: {
  options: FilterPillOption[];
  /** The nav's accessible name — "Filter reservations by stay". */
  label: string;
  /** The mobile sheet's heading — "Filter reservations". */
  sheetTitle: string;
}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const active = options.find((option) => option.current);

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button type="button" className={cn(pill('secondary', 'shadow-soft'), 'max-w-48')}>
                <AdjustmentsHorizontalIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {active && active.key !== 'all' ? t('ops.filtersActive', { label: active.label }) : t('ops.filters')}
                </span>
              </button>
            }
          />
          <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-[18px] border-t border-border">
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle className="text-display text-xl font-medium">{sheetTitle}</SheetTitle>
            </SheetHeader>
            <nav aria-label={label} className="flex flex-col gap-2 overflow-y-auto px-6 py-4">
              {options.map((option) => (
                <Link
                  key={option.key}
                  href={option.href}
                  aria-current={option.current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-12 items-center justify-between rounded-2xl px-4 text-sm font-medium transition-colors',
                    option.current
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground hover:bg-stone',
                  )}
                >
                  {option.label}
                  <span className={cn('tabular-nums', option.current ? 'opacity-80' : 'text-muted-foreground')}>
                    {option.count}
                  </span>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <nav aria-label={label} className="hidden lg:flex lg:flex-wrap lg:gap-2">
        {options.map((option) => (
          <Link
            key={option.key}
            href={option.href}
            aria-current={option.current ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
              option.current
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground hover:bg-stone',
            )}
          >
            {option.label}
            <span className={cn('tabular-nums', option.current ? 'opacity-80' : 'text-muted-foreground')}>
              {option.count}
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
