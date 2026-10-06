'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import type { RevenueKpis } from '@/lib/application/dashboard-stats';
import type { Currency } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { DATE_FNS_LOCALES, lDateShort, lMoney } from '@/lib/i18n/format';
import { INTL_TAGS } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';
import styles from './chart-gradients.module.css';

export interface RevenueDay extends RevenueKpis {
  date: string;
}

type MetricKey = keyof Omit<RevenueKpis, 'occupiedRooms'>;

const METRICS: Array<{ key: MetricKey; label: AdminTranslationKey; money: boolean }> = [
  { key: 'revpar', label: 'dashboard.revpar', money: true },
  { key: 'adr', label: 'dashboard.adr', money: true },
  { key: 'roomRevenue', label: 'dashboard.roomRevenue', money: true },
  { key: 'orders', label: 'dashboard.orders', money: false },
];

/**
 * The last week of the night's money, one small multiple per figure —
 * RevPAR, ADR, room revenue and bookings made are on four different
 * scales, so each gets its own plot rather than sharing an axis. Today is
 * the accent bar and the headline; yesterday is the comparison, as a
 * percentage beside it. The same bar style as the occupancy chart, so the
 * two read as one set, with a hover tooltip per bar and a table behind it.
 */
export function RevenueTrend({ days, currency }: { days: RevenueDay[]; currency: Currency }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const dateFns = DATE_FNS_LOCALES[locale];
  const [active, setActive] = React.useState<{ metric: MetricKey; index: number } | null>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const percent = new Intl.NumberFormat(INTL_TAGS[locale], { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 });

  const show = (metric: (typeof METRICS)[number], value: number) => (metric.money ? lMoney(value, currency, locale) : String(value));
  const delta = (metric: MetricKey): string | null => {
    if (!today || !yesterday || yesterday[metric] === 0) return null;
    return percent.format((today[metric] - yesterday[metric]) / yesterday[metric]);
  };

  // Desktop uses hover; on touch a press pins the metric/date tooltip so it
  // remains visible after the finger lifts. A pointer outside the charts
  // clears the selection.
  React.useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && chartRef.current?.contains(event.target)) return;
      setActive(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  return (
    <div className={cn('mt-5', styles.palette)}>
      <div ref={chartRef} className="grid gap-4">
        {METRICS.map((metric) => {
          const max = Math.max(...days.map((day) => day[metric.key]), 0);
          const change = delta(metric.key);
          const hovered = active?.metric === metric.key ? active.index : null;
          const shown = hovered === null ? null : days[hovered];
          return (
            <div key={metric.key} className="grid grid-cols-[minmax(0,1fr)_9rem] items-end gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t(metric.label)}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{today ? show(metric, today[metric.key]) : '—'}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {change ? t('dashboard.vsYesterday', { delta: change }) : t('dashboard.noYesterday')}
                </p>
              </div>
              <div className="relative">
                <ol aria-label={t('dashboard.revenueByDay', { metric: t(metric.label) })} className="flex h-12 items-end gap-0.5">
                  {days.map((day, index) => {
                    const isToday = index === days.length - 1;
                    const value = day[metric.key];
                    const height = max > 0 ? (value / max) * 100 : 0;
                    return (
                      <li key={day.date} className="flex h-full min-w-0 flex-1 items-end">
                        <button
                          type="button"
                          aria-label={`${lDateShort(day.date, locale)} · ${show(metric, value)}`}
                          onPointerDown={() => setActive({ metric: metric.key, index })}
                          onPointerEnter={() => setActive({ metric: metric.key, index })}
                          onPointerLeave={(event) => {
                            if (event.pointerType === 'touch') return;
                            setActive((current) => (current?.metric === metric.key && current.index === index ? null : current));
                          }}
                          onPointerCancel={() => setActive((current) => (current?.metric === metric.key && current.index === index ? null : current))}
                          onFocus={() => setActive({ metric: metric.key, index })}
                          onBlur={() => setActive(null)}
                          className="flex h-full w-full touch-pan-y cursor-default items-end rounded-t-[4px] outline-none focus-visible:bg-stone/60"
                        >
                          <span
                            className={cn(
                              'block w-full rounded-t-[4px] transition-opacity duration-150',
                              isToday ? styles.bar : styles.neutralBar,
                              hovered !== null && hovered !== index && 'opacity-50',
                            )}
                            style={{ height: `${Math.max(height, value > 0 ? 6 : 2)}%` }}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {shown && hovered !== null ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none absolute bottom-full z-10 mb-1.5 rounded-2xl border border-border bg-card px-3 py-1.5 whitespace-nowrap shadow-soft"
                    style={{ left: `${((hovered + 0.5) / days.length) * 100}%`, transform: `translateX(${hovered < 2 ? '-12%' : hovered > days.length - 3 ? '-88%' : '-50%'})` }}
                  >
                    <p className="text-sm font-semibold tabular-nums">{show(metric, shown[metric.key])}</p>
                    <p className="text-xs text-muted-foreground">
                      {hovered === days.length - 1 ? `${t('dashboard.today')} · ` : ''}
                      {lDateShort(shown.date, locale)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* One axis under the four plots — they share the same seven days. */}
        <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-4">
          <span />
          <ol aria-hidden="true" className="flex gap-0.5">
            {days.map((day, index) => (
              <li
                key={day.date}
                className={cn(
                  'min-w-0 flex-1 text-center text-[10px] leading-tight',
                  index === days.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {format(parseISO(day.date), 'EEEEE', { locale: dateFns })}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <details className="mt-4 border-t border-border pt-1 text-sm">
        <summary className="flex min-h-10 cursor-pointer items-center text-muted-foreground hover:text-foreground">
          {t('occupancy.showTable')}
        </summary>
        <div className="relative mt-1 overflow-x-auto contain-inline-size">
          <table className="w-full min-w-[24rem] border-collapse text-sm">
            <caption className="sr-only">{t('dashboard.revenueTableCaption')}</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-normal">{t('dashboard.day')}</th>
                {METRICS.map((metric) => (
                  <th key={metric.key} scope="col" className="py-2 pr-3 text-right font-normal last:pr-0">
                    {t(metric.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => (
                <tr key={day.date} className={cn('border-b border-border last:border-b-0', index === days.length - 1 && 'font-medium')}>
                  <td className="py-2 pr-3 whitespace-nowrap">{lDateShort(day.date, locale)}</td>
                  {METRICS.map((metric) => (
                    <td key={metric.key} className="py-2 pr-3 text-right tabular-nums last:pr-0">
                      {show(metric, day[metric.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
