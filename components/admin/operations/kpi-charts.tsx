'use client';

import { useId } from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';
import { ChartGradientDefs } from './chart-gradient-defs';
import styles from './chart-gradients.module.css';

/**
 * The dashboard's four headline figures each get a mark that shows the shape
 * behind the number rather than a lone progress line: a gauge for a ratio of
 * a whole, a segmented bar for a mix, a donut for outcomes, labelled bars for
 * a trend. Accent carries the figure being read; everything else sits in the
 * stone ramp so the one highlighted value is always the first thing seen.
 */

function clampShare(share: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
}

/** Tonight's occupancy as a half-dial, with a delta against tomorrow beside it. */
export function OccupancyGauge({
  share,
  arrivals,
  departures,
  tomorrowShare,
}: {
  share: number;
  arrivals: number;
  departures: number;
  tomorrowShare: number | null;
}) {
  const percent = Math.round(clampShare(share) * 100);
  const delta = tomorrowShare === null ? null : Math.round(clampShare(tomorrowShare) * 100) - percent;
  const t = useAdminT();
  const gradientId = useId();
  return (
    <div className={styles.palette}>
      <div className="relative mx-auto w-full max-w-44">
        <svg viewBox="0 0 100 56" aria-hidden="true" className="block w-full overflow-visible">
          <ChartGradientDefs id={gradientId} />
          <path
            d="M 8 50 A 42 42 0 0 1 92 50"
            pathLength={100}
            fill="none"
            strokeWidth={9}
            strokeLinecap="round"
            className="stroke-accent-soft"
          />
          <path
            d="M 8 50 A 42 42 0 0 1 92 50"
            pathLength={100}
            fill="none"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(percent, 0.5)} 100`}
            stroke={`url(#${gradientId}-accent)`}
            className={styles.glow}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="text-display block text-2xl leading-none tabular-nums">{percent}%</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{t('kpi.occupancy')}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs">
        <Chip tone="blue">{t('kpi.in', { count: arrivals })}</Chip>
        <Chip tone="stone">{t('kpi.out', { count: departures })}</Chip>
        {delta !== null ? (
          <Chip tone={delta > 0 ? 'blue' : delta < 0 ? 'rose' : 'stone'}>
            {t('kpi.tomorrow', { delta: `${delta > 0 ? '+' : ''}${delta}` })}
          </Chip>
        ) : null}
      </div>
    </div>
  );
}

export interface MixSegment {
  label: string;
  value: number;
}

const MIX_TONES = [
  styles.accent,
  cn(styles.accent, 'opacity-75'),
  styles.light,
  cn(styles.light, 'opacity-70'),
  styles.stone,
  cn(styles.stone, 'opacity-60'),
];

/** A whole split into its parts, largest first, with a legend that carries the counts. */
export function MixBar({ segments }: { segments: MixSegment[] }) {
  const parts = segments.filter((segment) => segment.value > 0).sort((a, b) => b.value - a.value);
  const total = parts.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;
  return (
    <div className={cn('mt-4', styles.palette)}>
      <div aria-hidden="true" className={cn('flex h-3 w-full gap-0.5 overflow-hidden rounded-full', styles.mix)}>
        {parts.map((segment, index) => (
          <span
            key={segment.label}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', styles.mixSegment, MIX_TONES[index % MIX_TONES.length])}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {parts.map((segment, index) => (
          <li key={segment.label} className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', MIX_TONES[index % MIX_TONES.length])}
            />
            <span className="truncate text-muted-foreground">{segment.label}</span>
            <span className="ml-auto font-medium tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A whole split into its parts as a short ranked list: each part gets its own
 * row — name, count, share — over a bar sized against the whole. Reads at a
 * glance where a thin stacked strip with a legend under it did not, and fills
 * its card the way its neighbours' charts do. More than `limit` parts fold
 * the smallest into one "other" row.
 */
export function BarList({ segments, limit = 4, otherLabel }: { segments: MixSegment[]; limit?: number; otherLabel: string }) {
  const sorted = segments.filter((segment) => segment.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;
  const rows =
    sorted.length > limit
      ? [...sorted.slice(0, limit - 1), { label: otherLabel, value: sorted.slice(limit - 1).reduce((sum, segment) => sum + segment.value, 0) }]
      : sorted;
  return (
    <ul className={cn('grid gap-3', styles.palette)}>
      {rows.map((row, index) => {
        const share = row.value / total;
        return (
          <li key={row.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{row.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-foreground">{row.value}</span>
                <span className="ml-1.5 text-muted-foreground">{Math.round(share * 100)}%</span>
              </span>
            </div>
            <div aria-hidden="true" className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone">
              <div
                className={cn('h-full rounded-full', index === 0 ? styles.accent : styles.light)}
                style={{ width: `${Math.max(share * 100, 3)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  tone: 'accent' | 'light' | 'stone';
}

const DONUT_DOT: Record<DonutSlice['tone'], string> = {
  accent: styles.accent,
  light: styles.light,
  stone: styles.stone,
};

/** Outcomes of one set, the headline share in the hole. */
export function Donut({ slices, centre, caption, footnote }: { slices: DonutSlice[]; centre: string; caption: string; footnote?: string }) {
  const gradientId = useId();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;
  return (
    <div className={styles.palette}>
    <div className="flex items-center gap-4">
      <div className="relative size-24 shrink-0">
        <svg viewBox="0 0 42 42" aria-hidden="true" className={cn('size-full -rotate-90 overflow-visible', styles.glow)}>
          <ChartGradientDefs id={gradientId} />
          <circle cx="21" cy="21" r="15.915" fill="none" strokeWidth={6} className="stroke-accent-soft" />
          {total > 0
            ? slices.map((slice) => {
                const length = (slice.value / total) * 100;
                const dash = (
                  <circle
                    key={slice.label}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    strokeWidth={6}
                    pathLength={100}
                    strokeDasharray={`${Math.max(length - (slices.length > 1 ? 1 : 0), 0)} ${100 - length + (slices.length > 1 ? 1 : 0)}`}
                    strokeDashoffset={-offset}
                    stroke={`url(#${gradientId}-${slice.tone})`}
                  />
                );
                offset += length;
                return slice.value > 0 ? dash : null;
              })
            : null}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-display text-xl leading-none tabular-nums">{centre}</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">{caption}</span>
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 gap-2 text-xs">
        {slices.filter((slice) => slice.value > 0).map((slice) => (
          <li key={slice.label} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DONUT_DOT[slice.tone])} />
            <span className="leading-tight text-muted-foreground">{slice.label}</span>
            <span className="ml-auto font-medium tabular-nums">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
    {footnote ? <p className="mt-3 text-xs text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}

export interface ValueBar {
  label: string;
  value: number;
  /** The figure printed on top of the bar. */
  display: string;
  current?: boolean;
}

/**
 * A short trend: taller bars with rounded tops, the current period in the
 * accent. Only the current and the peak bar carry a figure — a number on
 * every bar was noise at this size.
 */
export function ValueBars({ bars }: { bars: ValueBar[] }) {
  const max = Math.max(...bars.map((bar) => bar.value), 0);
  const peak = bars.findIndex((bar) => bar.value === max && max > 0);
  return (
    <div aria-hidden="true" className={styles.palette}>
      <div className="flex h-28 items-end gap-2">
        {bars.map((bar, index) => {
          const height = max > 0 ? (bar.value / max) * 82 : 0;
          const labelled = bar.value > 0 && (bar.current || index === peak);
          return (
            <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <span
                className={cn(
                  'mb-1 -mx-2 text-center text-[10px] whitespace-nowrap tabular-nums',
                  bar.current ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {labelled ? bar.display : ''}
              </span>
              <span
                className={cn('mx-auto block w-full max-w-10 rounded-t-lg rounded-b-sm', bar.current ? styles.bar : styles.neutralBar)}
                style={{ height: `${Math.max(height, bar.value > 0 ? 8 : 3)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {bars.map((bar) => (
          <span
            key={bar.label}
            className={cn(
              'min-w-0 flex-1 text-center text-[10px] whitespace-nowrap',
              bar.current ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Chip({ tone, children }: { tone: 'blue' | 'stone' | 'rose'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-medium whitespace-nowrap tabular-nums',
        tone === 'blue' && 'bg-accent-soft text-accent-strong',
        tone === 'stone' && 'bg-stone text-muted-foreground',
        tone === 'rose' && 'bg-tint-rose text-tint-rose-ink',
      )}
    >
      {children}
    </span>
  );
}
