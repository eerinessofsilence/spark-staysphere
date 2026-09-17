import { cn } from '@/lib/utils';

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
  return (
    <div className="mt-4">
      <div className="relative mx-auto w-full max-w-44">
        <svg viewBox="0 0 100 56" aria-hidden="true" className="block w-full overflow-visible">
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
            className="stroke-accent"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="text-display block text-2xl leading-none tabular-nums">{percent}%</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">occupancy</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs">
        <Chip tone="sage">↓ {arrivals} in</Chip>
        <Chip tone="stone">↑ {departures} out</Chip>
        {delta !== null ? (
          <Chip tone={delta > 0 ? 'sage' : delta < 0 ? 'rose' : 'stone'}>
            {delta > 0 ? '+' : ''}
            {delta} pt tomorrow
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
  'bg-accent',
  'bg-tint-sand-ink',
  'bg-tint-sage-ink',
  'bg-tint-clay-ink/60',
  'bg-tint-rose-ink/70',
  'bg-tint-stone-ink/50',
];

/** A whole split into its parts, largest first, with a legend that carries the counts. */
export function MixBar({ segments }: { segments: MixSegment[] }) {
  const parts = segments.filter((segment) => segment.value > 0).sort((a, b) => b.value - a.value);
  const total = parts.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;
  return (
    <div className="mt-4">
      <div aria-hidden="true" className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.map((segment, index) => (
          <span
            key={segment.label}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', MIX_TONES[index % MIX_TONES.length])}
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

export interface DonutSlice {
  label: string;
  value: number;
  tone: 'accent' | 'stone' | 'sand' | 'rose';
}

const DONUT_STROKE: Record<DonutSlice['tone'], string> = {
  accent: 'stroke-accent',
  stone: 'stroke-tint-stone-ink/35',
  sand: 'stroke-tint-sand-ink',
  rose: 'stroke-tint-rose-ink/70',
};

const DONUT_DOT: Record<DonutSlice['tone'], string> = {
  accent: 'bg-accent',
  stone: 'bg-tint-stone-ink/35',
  sand: 'bg-tint-sand-ink',
  rose: 'bg-tint-rose-ink/70',
};

/** Outcomes of one set, the headline share in the hole. */
export function Donut({ slices, centre, caption }: { slices: DonutSlice[]; centre: string; caption: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;
  return (
    <div className="mt-4 flex items-center gap-4">
      <div className="relative size-24 shrink-0">
        <svg viewBox="0 0 42 42" aria-hidden="true" className="size-full -rotate-90">
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
                    className={DONUT_STROKE[slice.tone]}
                  />
                );
                offset += length;
                return slice.value > 0 ? dash : null;
              })
            : null}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-display text-lg leading-none tabular-nums">{centre}</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">{caption}</span>
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 gap-1.5 text-xs">
        {slices.filter((slice) => slice.value > 0).map((slice) => (
          <li key={slice.label} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DONUT_DOT[slice.tone])} />
            <span className="truncate text-muted-foreground">{slice.label}</span>
            <span className="ml-auto font-medium tabular-nums">{slice.value}</span>
          </li>
        ))}
      </ul>
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

/** A short trend where every bar carries its own figure, the current period in the accent. */
export function ValueBars({ bars }: { bars: ValueBar[] }) {
  const max = Math.max(...bars.map((bar) => bar.value), 0);
  return (
    <div aria-hidden="true" className="mt-4">
      <div className="flex h-24 items-end gap-1.5">
        {bars.map((bar) => {
          const height = max > 0 ? (bar.value / max) * 100 : 0;
          return (
            <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <span
                className={cn(
                  'mb-1 -mx-2 text-center text-[10px] whitespace-nowrap tabular-nums',
                  bar.current ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {bar.value > 0 ? bar.display : ''}
              </span>
              <span
                className={cn(
                  'block w-full rounded-t-md',
                  bar.current ? 'bg-accent' : 'bg-tint-stone-ink/25',
                )}
                style={{ height: `${Math.max(height, bar.value > 0 ? 6 : 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-border pt-1.5">
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

function Chip({ tone, children }: { tone: 'sage' | 'stone' | 'rose'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-medium whitespace-nowrap tabular-nums',
        tone === 'sage' && 'bg-tint-sage text-tint-sage-ink',
        tone === 'stone' && 'bg-stone text-muted-foreground',
        tone === 'rose' && 'bg-tint-rose text-tint-rose-ink',
      )}
    >
      {children}
    </span>
  );
}
