'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import type { ChessboardDay } from '@/lib/application/inventory-service';
import { cn } from '@/lib/utils';

const ticks = [0, 25, 50, 75, 100];

function share(occupied: number, totalRooms: number): number {
  return totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
}

function describe(day: ChessboardDay, totalRooms: number, tonight: boolean): string {
  const when = tonight ? `Tonight, ${format(parseISO(day.date), 'EEE d MMM')}` : format(parseISO(day.date), 'EEE d MMM');
  return `${when}: ${day.occupied} of ${totalRooms} rooms occupied (${share(day.occupied, totalRooms)}%), ${day.arrivals} arriving, ${day.departures} leaving`;
}

/** Tonight carries the accent as the active day; the rest stay in the neutral stone ink. */
export function OccupancyChart({ days, totalRooms }: { days: ChessboardDay[]; totalRooms: number }) {
  const [active, setActive] = React.useState<number | null>(null);
  const peak = days.reduce((best, day, index) => (day.occupied > (days[best]?.occupied ?? -1) ? index : best), 0);
  const shown = active === null ? undefined : days[active];
  const offset = active === null ? '-50%' : active < 2 ? '-12%' : active > days.length - 3 ? '-88%' : '-50%';
  // Floats just above the hovered bar and its label; a very full night keeps it inside the plot.
  const lift = shown ? Math.min(share(shown.occupied, totalRooms), 70) : 0;

  return (
    <figure className="min-w-0 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
      <figcaption>
        <h3 className="font-medium">Occupied rooms, next {days.length} nights</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Share of all {totalRooms} rooms, including simulated demand. Tonight is highlighted.
        </p>
      </figcaption>

      <div className="mt-8 flex gap-2">
        <div aria-hidden="true" className="relative h-48 w-10 shrink-0 text-xs text-muted-foreground tabular-nums sm:h-56">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${tick}%` }}>
              {tick}%
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative h-48 sm:h-56">
            {ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden="true"
                className={cn('absolute inset-x-0 border-t', tick === 0 ? 'border-muted-foreground/40' : 'border-border')}
                style={{ bottom: `${tick}%` }}
              />
            ))}

            <ol aria-label="Occupancy by night" className="absolute inset-0 flex">
              {days.map((day, index) => {
                const value = share(day.occupied, totalRooms);
                const tonight = index === 0;
                const labelled = tonight || (index === peak && peak !== 0);
                return (
                  <li key={day.date} className="flex min-w-0 flex-1">
                    <button
                      type="button"
                      aria-label={describe(day, totalRooms, tonight)}
                      onPointerEnter={() => setActive(index)}
                      onPointerLeave={() => setActive((current) => (current === index ? null : current))}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      className="flex h-full w-full cursor-default items-end justify-center rounded-t-lg px-px outline-none focus-visible:bg-stone/60"
                    >
                      <span
                        className={cn(
                          'relative block w-full max-w-6 rounded-t-[4px] transition-opacity duration-150',
                          tonight ? 'bg-accent' : 'bg-tint-stone-ink',
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
                aria-hidden="true"
                className="pointer-events-none absolute z-10 rounded-2xl border border-border bg-card px-3 py-2 whitespace-nowrap shadow-soft"
                style={{
                  left: `${((active + 0.5) / days.length) * 100}%`,
                  bottom: `calc(${lift}% + 1.75rem)`,
                  transform: `translateX(${offset})`,
                }}
              >
                <p className="text-sm font-semibold">
                  {shown.occupied} of {totalRooms} rooms · {share(shown.occupied, totalRooms)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {active === 0 ? 'Tonight · ' : ''}
                  {format(parseISO(shown.date), 'EEE d MMM')} · {shown.arrivals} arriving · {shown.departures} leaving
                </p>
              </div>
            ) : null}
          </div>

          <ol aria-hidden="true" className="mt-2 flex">
            {days.map((day, index) => (
              <li key={day.date} className="min-w-0 flex-1 text-center text-[11px] leading-tight text-muted-foreground">
                <span className="block sm:hidden">{format(parseISO(day.date), 'EEEEE')}</span>
                <span className="hidden truncate sm:block">{index === 0 ? 'Today' : format(parseISO(day.date), 'EEE')}</span>
                <span className={cn('block tabular-nums', index === 0 && 'font-semibold text-foreground')}>
                  {format(parseISO(day.date), 'd')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <details className="mt-5 border-t border-border pt-2 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground hover:text-foreground">
          Show as a table
        </summary>
        <div className="relative mt-2 overflow-x-auto contain-inline-size">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <caption className="sr-only">Occupied rooms by night</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-normal">Night</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Occupied</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Share</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Arriving</th>
                <th scope="col" className="py-2 text-right font-normal">Leaving</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-4">{format(parseISO(day.date), 'EEE d MMM')}</td>
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
    </figure>
  );
}
