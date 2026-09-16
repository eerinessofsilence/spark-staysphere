'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface StatusFilterOption {
  key: string;
  label: string;
  count: number;
  href: string;
  current: boolean;
}

/**
 * The stay-status pills (All / Upcoming / In house / Past / Cancelled): a
 * plain inline row on desktop, but five pills wrap into a cramped second row
 * on a phone screen — so on mobile they move into a bottom sheet behind one
 * "Filters" button, the same pattern as the guest room filters.
 */
export function BookingStatusFilter({ options }: { options: StatusFilterOption[] }) {
  const [open, setOpen] = React.useState(false);
  const active = options.find((option) => option.current);

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button type="button" className={pill('secondary', 'w-full shadow-soft')}>
                <AdjustmentsHorizontalIcon className="size-4" aria-hidden="true" />
                {active && active.key !== 'all' ? `Filters · ${active.label}` : 'Filters'}
              </button>
            }
          />
          <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-[18px] border-t border-border">
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle className="text-display text-xl font-medium">Filter reservations</SheetTitle>
            </SheetHeader>
            <nav aria-label="Filter reservations by stay" className="flex flex-col gap-2 overflow-y-auto px-6 py-4">
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

      <nav aria-label="Filter reservations by stay" className="hidden lg:flex lg:flex-wrap lg:gap-2">
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
