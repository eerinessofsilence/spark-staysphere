'use client';

import { ArrowsClockwise, Warning } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';
import type { ScreenPolygon } from './sphere-geometry';
import type { PanoramaStatus } from './types';

/**
 * The projected footprints over the sphere. They never take the pointer — a
 * drag that starts on a building must still turn the view — so the viewer
 * hit-tests them itself.
 */
export function SphereOutlines({ polygons, lit }: { polygons: Record<string, ScreenPolygon>; lit?: string[] }) {
  const entries = Object.entries(polygons);
  if (entries.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 size-full" aria-hidden="true">
      {entries.map(([id, points]) => (
        <polygon
          key={id}
          points={points.map(([x, y]) => `${x},${y}`).join(' ')}
          strokeWidth={2.5}
          strokeLinejoin="round"
          className={cn(
            'transition-[fill,stroke] duration-200',
            lit?.includes(id)
              ? 'fill-white/20 stroke-accent [filter:drop-shadow(0_1px_4px_rgb(22_22_22/0.45))]'
              : 'fill-transparent stroke-white/35',
          )}
        />
      ))}
    </svg>
  );
}

/** Loading and failure, in the product's own words — the library's own chrome is switched off. */
export function PanoramaPlaceholder({ status }: { status: Exclude<PanoramaStatus, 'ready'> }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone text-sm text-muted-foreground">
      {status === 'loading' ? (
        <>
          <ArrowsClockwise weight="bold" className="size-5 animate-spin" aria-hidden="true" />
          Loading the 360° view…
        </>
      ) : (
        <>
          <Warning weight="fill" className="size-5" aria-hidden="true" />
          This browser could not display the 360° view.
        </>
      )}
    </div>
  );
}
