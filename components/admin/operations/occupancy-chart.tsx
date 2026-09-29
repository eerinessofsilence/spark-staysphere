'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import type { FrontDeskDay } from '@/lib/application/inventory-service';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { DATE_FNS_LOCALES, lDateShort, lNights, lRoomCount } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';
import styles from './chart-gradients.module.css';

const ISO = 'yyyy-MM-dd';
const ticks = [0, 25, 50, 75, 100];
const PRESETS = [7, 14, 30] as const;

type Period = { key: 'preset'; nights: (typeof PRESETS)[number] } | { key: 'custom'; nights: number };

function share(occupied: number, totalRooms: number): number {
  return totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
}

function describe(day: FrontDeskDay, totalRooms: number, tonight: boolean, t: AdminT, locale: Locale): string {
  const date = lDateShort(day.date, locale);
  return t('occupancy.describe', {
    when: tonight ? t('occupancy.tonightWhen', { date }) : date,
    occupied: day.occupied,
    total: totalRooms,
    share: share(day.occupied, totalRooms),
    arrivals: day.arrivals,
    departures: day.departures,
  });
}

/**
 * Tonight carries the accent as the active day; the rest stay in the neutral
 * stone ink. `allDays` is the widest window the desk fetched (see the
 * dashboard's `getFrontDesk` call) — the period picker below only ever
 * slices it, so switching costs no round trip.
 */
export function OccupancyChart({ allDays, totalRooms }: { allDays: FrontDeskDay[]; totalRooms: number }) {
  const [active, setActive] = React.useState<number | null>(null);
  const [period, setPeriod] = React.useState<Period>({ key: 'preset', nights: 14 });
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Date | undefined>(undefined);
  const [months, setMonths] = React.useState(1);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const t = useAdminT();
  const locale = useAdminLocale();
  const dateFns = DATE_FNS_LOCALES[locale];

  const today = allDays[0]!.date;
  const windowEnd = allDays[allDays.length - 1]!.date;

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const apply = () => setMonths(query.matches ? 2 : 1);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const nights = period.nights;
  const days = allDays.slice(0, nights);

  // The window always starts tonight — there is nothing to view before it —
  // so the dialog only ever asks for its last night, not a two-ended range.
  React.useEffect(() => {
    if (open) setDraft(parseISO(days[days.length - 1]!.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Hover drives the desktop tooltip. On touch there is no hover, so a press
  // pins the same tooltip until another bar or the space outside the chart is
  // pressed. This keeps the detail card readable after the finger lifts.
  React.useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && chartRef.current?.contains(event.target)) return;
      setActive(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  const close = React.useCallback(() => setOpen(false), []);
  const draftIso = draft ? format(draft, ISO) : null;

  const peak = days.reduce((best, day, index) => (day.occupied > (days[best]?.occupied ?? -1) ? index : best), 0);
  const shown = active === null ? undefined : days[active];
  const offset = active === null ? '-50%' : active < 2 ? '-12%' : active > days.length - 3 ? '-88%' : '-50%';
  // Floats just above the hovered bar and its label; a very full night keeps it inside the plot.
  const lift = shown ? Math.min(share(shown.occupied, totalRooms), 70) : 0;

  return (
    <figure className={cn('min-w-0 rounded-[18px] bg-card p-5 shadow-soft sm:p-6', styles.palette)}>
      <figcaption>
        <h3 className="font-medium">{t('occupancy.title', { nights: lNights(days.length, locale) })}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('occupancy.body', { rooms: lRoomCount(totalRooms, locale) })}</p>
      </figcaption>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t('reports.period')}>
        {PRESETS.map((n) => {
          const isActive = period.key === 'preset' && period.nights === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={isActive}
              onClick={() => setPeriod({ key: 'preset', nights: n })}
              className={pill(isActive ? 'primary' : 'secondary', 'min-h-9 px-3.5 text-xs')}
            >
              {t('dashboard.nextDays', { n })}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={pill(period.key === 'custom' ? 'primary' : 'secondary', 'min-h-9 px-3.5 text-xs')}
        >
          {t('reports.customDates')}
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <div aria-hidden="true" className="relative h-48 w-10 shrink-0 text-xs text-muted-foreground tabular-nums sm:h-56">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${tick}%` }}>
              {tick}%
            </span>
          ))}
        </div>

        <div ref={chartRef} className="relative min-w-0 flex-1">
          <div className="relative h-48 sm:h-56">
            {ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden="true"
                className={cn('absolute inset-x-0 border-t', tick === 0 ? 'border-muted-foreground/40' : 'border-border')}
                style={{ bottom: `${tick}%` }}
              />
            ))}

            <ol aria-label={t('occupancy.byNight')} className="absolute inset-0 flex">
              {days.map((day, index) => {
                const value = share(day.occupied, totalRooms);
                const tonight = day.date === today;
                const labelled = tonight || (index === peak && !tonight);
                return (
                  <li key={day.date} className="flex min-w-0 flex-1">
                    <button
                      type="button"
                      aria-label={describe(day, totalRooms, tonight, t, locale)}
                      onPointerDown={() => setActive(index)}
                      onPointerEnter={() => setActive(index)}
                      onPointerLeave={(event) => {
                        // Touch has no stable hover boundary; keep its
                        // selection pinned until the user chooses elsewhere.
                        if (event.pointerType === 'touch') return;
                        setActive((current) => (current === index ? null : current));
                      }}
                      onPointerCancel={() => setActive((current) => (current === index ? null : current))}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      className="flex h-full w-full touch-pan-y cursor-default items-end justify-center rounded-t-lg px-px outline-none focus-visible:bg-stone/60"
                    >
                      <span
                        className={cn(
                          'relative block w-full max-w-6 rounded-t-[4px] transition-opacity duration-150',
                          tonight ? styles.bar : styles.neutralBar,
                          active !== null && active !== index && 'opacity-50',
                        )}
                        style={{ height: `${Math.max(value, 1)}%` }}
                      >
                        {labelled ? (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-foreground"
                          >
                            {value}%
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {shown && active !== null ? (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute z-10 rounded-2xl border border-border bg-card px-3 py-2 whitespace-nowrap shadow-soft"
                style={{
                  left: `${((active + 0.5) / days.length) * 100}%`,
                  bottom: `calc(${lift}% + 1.75rem)`,
                  transform: `translateX(${offset})`,
                }}
              >
                <p className="text-sm font-semibold">
                  {t('occupancy.tooltipHead', { occupied: shown.occupied, total: totalRooms, share: share(shown.occupied, totalRooms) })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {shown.date === today ? `${t('occupancy.tonight')} · ` : ''}
                  {t('occupancy.tooltipBody', { date: lDateShort(shown.date, locale), arrivals: shown.arrivals, departures: shown.departures })}
                </p>
              </div>
            ) : null}
          </div>

          <ol aria-hidden="true" className="mt-2 flex">
            {days.map((day) => (
              <li key={day.date} className="min-w-0 flex-1 text-center text-[11px] leading-tight text-muted-foreground">
                <span className="block sm:hidden">{format(parseISO(day.date), 'EEEEE', { locale: dateFns })}</span>
                <span className="hidden truncate sm:block">
                  {day.date === today ? t('occupancy.today') : format(parseISO(day.date), 'EEE', { locale: dateFns })}
                </span>
                <span className={cn('block tabular-nums', day.date === today && 'font-semibold text-foreground')}>
                  {format(parseISO(day.date), 'd')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <details className="mt-5 border-t border-border pt-2 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground hover:text-foreground">
          {t('occupancy.showTable')}
        </summary>
        <div className="relative mt-2 overflow-x-auto contain-inline-size">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <caption className="sr-only">{t('occupancy.tableCaption')}</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-normal">{t('occupancy.night')}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{t('occupancy.occupied')}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{t('occupancy.share')}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{t('occupancy.arriving')}</th>
                <th scope="col" className="py-2 text-right font-normal">{t('occupancy.leaving')}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-4">{lDateShort(day.date, locale)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {day.occupied} / {totalRooms}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{share(day.occupied, totalRooms)}%</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{day.arrivals}</td>
                  <td className="py-2 text-right tabular-nums">{day.departures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <Modal open={open} onClose={close} title={t('occupancy.throughDate')} className="sm:max-w-[36rem]">
        <DayPicker
          mode="single"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={months}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          defaultMonth={draft ?? parseISO(today)}
          disabled={{ before: parseISO(today), after: parseISO(windowEnd) }}
          classNames={CALENDAR_CLASS_NAMES}
          components={CALENDAR_COMPONENTS}
          locale={DATE_FNS_LOCALES[locale]}
        />
        <div className="mt-4 border-t border-border pt-4">
          <p role="status" className="text-center text-sm text-muted-foreground">
            {draftIso ? `${lDateShort(today, locale)} – ${lDateShort(draftIso, locale)}` : t('occupancy.throughDate')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={close} className={pill('ghost', 'min-h-10 px-4')}>
              {t('frontDesk.cancel')}
            </button>
            <button
              type="button"
              disabled={!draftIso}
              onClick={() => {
                if (!draftIso) return;
                const span = Math.round((parseISO(draftIso).getTime() - parseISO(today).getTime()) / 86_400_000) + 1;
                setPeriod({ key: 'custom', nights: Math.max(1, span) });
                close();
              }}
              className={pill('primary', 'min-h-10 px-5')}
            >
              {t('ops.show')}
            </button>
          </div>
        </div>
      </Modal>
    </figure>
  );
}
