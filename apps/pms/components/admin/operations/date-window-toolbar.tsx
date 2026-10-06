import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { addIsoDays } from '@/lib/domain/dates';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { lDateShort, lNights } from '@/lib/i18n/format';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

type HrefFor = (params: { from: string; days: number }) => string;

/** Prev/today/next — the one shape every "N nights shown" screen turns the window with. */
export function DateNavArrows({
  from,
  days,
  today,
  locale,
  t,
  hrefFor,
}: {
  from: string;
  days: number;
  today: string;
  locale: AdminLocale;
  t: AdminT;
  hrefFor: HrefFor;
}) {
  const nights = lNights(days, locale);
  return (
    <div className="flex items-center gap-2">
      <Link
        href={hrefFor({ from: addIsoDays(from, -days), days })}
        aria-label={t('frontDesk.previousNights', { nights })}
        className={iconButton('light')}
      >
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
      </Link>
      <Link
        href={hrefFor({ from: today, days })}
        aria-current={from === today ? 'true' : undefined}
        className={pill('secondary')}
      >
        {t('frontDesk.today')}
      </Link>
      <Link
        href={hrefFor({ from: addIsoDays(from, days), days })}
        aria-label={t('frontDesk.nextNights', { nights })}
        className={iconButton('light')}
      >
        <ChevronRightIcon className="size-5" aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * The window itself, as pills to press rather than a menu to open first —
 * every admin screen with a "nights shown" concept (the front desk, both
 * rates screens) uses the same fixed options (front-desk-shared.ts's
 * `WINDOW_OPTIONS`) and now the same look for choosing among them.
 */
export function WindowSizePills({
  from,
  days,
  locale,
  windowOptions,
  hrefFor,
}: {
  from: string;
  days: number;
  locale: AdminLocale;
  windowOptions: readonly number[];
  hrefFor: HrefFor;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {windowOptions.map((option) => (
        <Link
          key={option}
          href={hrefFor({ from, days: option })}
          aria-current={option === days ? 'page' : undefined}
          className={cn(
            'flex min-h-8 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors',
            option === days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone hover:text-foreground',
          )}
        >
          {lNights(option, locale)}
        </Link>
      ))}
    </div>
  );
}

/**
 * The full row: prev/today/next, the window as pills, then the range in
 * plain text — what `/admin/rates` and `/admin/rates/[id]` both use as-is,
 * and what the front desk's own toolbar builds the same two pieces above
 * into around its extra room-type filter and mobile sheet.
 */
export function DateWindowToolbar({
  from,
  days,
  today,
  locale,
  t,
  windowOptions,
  hrefFor,
  before,
  after,
}: {
  from: string;
  days: number;
  today: string;
  locale: AdminLocale;
  t: AdminT;
  windowOptions: readonly number[];
  hrefFor: HrefFor;
  /** Rendered before the date controls — a search box, say. */
  before?: ReactNode;
  /** Rendered after the date controls — a room-type filter, say. */
  after?: ReactNode;
}) {
  const lastNight = addIsoDays(from, days - 1);

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {before}
      <DateNavArrows from={from} days={days} today={today} locale={locale} t={t} hrefFor={hrefFor} />
      <WindowSizePills from={from} days={days} locale={locale} windowOptions={windowOptions} hrefFor={hrefFor} />
      <p className="text-sm text-muted-foreground">
        {t('ops.dateRange', { from: lDateShort(from, locale), to: lDateShort(lastNight, locale) })}
      </p>
      {after}
    </div>
  );
}
