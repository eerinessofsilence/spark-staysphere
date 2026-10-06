'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RoomFacts } from '@/components/rooms/room-facts';
import { coverRect, type Size } from '@/components/site/cover-fit';
import type { GuestSpinnerZone } from '@/lib/application/catalog-service';
import { withStayQuery } from '@/lib/application/search-params';
import { centroid, toPathData } from '@/lib/domain/polygon/geometry';
import { useLocale, useT } from '@/lib/i18n/context';
import { lRoomLine } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

/**
 * The zones drawn in `/admin/content/spinner`, traced on the frame the
 * building is currently stopped on. A zone only exists on a key-angle frame
 * (see `docs/decisions/0006-spinner-markup.md`), so `zones` is expected
 * pre-filtered to the current frame — nothing here reads `frameIndex` itself.
 *
 * Same interaction as the flat-photo areas' floor bands (`hotel-scene.tsx`):
 * invisible until hovered or focused, so the facade doesn't read as a web of
 * outlines (see `git show f6c8e26`, the commit that dropped the spinner's
 * earlier always-on outline layer for exactly that reason). A label chip
 * follows the outline's centroid; a click goes straight to the zone's
 * target — there's no anchored preview card here the way a pinned marker
 * gets one, since a zone's shape is already the affordance.
 */
export function SpinnerZonesOverlay({
  zones,
  frameSize,
  stage,
  hidden,
  stayQuery,
  rooms,
}: {
  zones: GuestSpinnerZone[];
  frameSize: Size;
  stage: Size;
  /** True while the building is turning — zones hide the same way markers do. */
  hidden: boolean;
  stayQuery?: string;
  rooms?: Record<string, RoomFacts>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  if (hidden || zones.length === 0 || stage.width === 0) return null;

  const rect = coverRect(frameSize, stage);
  const hovered = zones.find((zone) => zone.id === hoveredId) ?? null;

  const labelFor = (zone: GuestSpinnerZone): { title: string; line: string | null } => {
    switch (zone.kind) {
      case 'unit':
        return { title: rooms?.[zone.roomSlug]?.name ?? zone.unitNumber, line: lRoomLine(rooms?.[zone.roomSlug], locale) };
      case 'roomType':
        return { title: rooms?.[zone.roomSlug]?.name ?? zone.roomSlug, line: lRoomLine(rooms?.[zone.roomSlug], locale) };
      case 'floor':
        return { title: t('home.spinnerFloorZone', { floor: String(zone.floor) }), line: zone.roomNames.join(' · ') };
      case 'link':
        return { title: zone.label, line: null };
    }
  };

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-[5] size-full" aria-hidden="true">
        <g transform={`translate(${rect.x} ${rect.y}) scale(${rect.width / frameSize.width} ${rect.height / frameSize.height})`}>
          {zones.map((zone) => {
            const lit = zone.id === hoveredId;
            const { title } = labelFor(zone);
            return (
              <path
                key={zone.id}
                data-testid="spinner-zone"
                d={toPathData(zone.polygon, frameSize.width, frameSize.height)}
                strokeWidth={2 * (frameSize.width / rect.width)}
                strokeLinejoin="round"
                tabIndex={0}
                role="link"
                aria-label={title}
                onMouseEnter={() => setHoveredId(zone.id)}
                onMouseLeave={() => setHoveredId((current) => (current === zone.id ? null : current))}
                onFocus={() => setHoveredId(zone.id)}
                onBlur={() => setHoveredId((current) => (current === zone.id ? null : current))}
                onClick={() => router.push(withStayQuery(zone.href, stayQuery))}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  router.push(withStayQuery(zone.href, stayQuery));
                }}
                className={cn(
                  'pointer-events-auto cursor-pointer transition-[fill,stroke] duration-200 focus-visible:outline-none',
                  lit
                    ? 'fill-white/20 stroke-accent [filter:drop-shadow(0_1px_4px_rgb(22_22_22/0.45))]'
                    : 'fill-transparent stroke-transparent',
                )}
              />
            );
          })}
        </g>
      </svg>

      {hovered
        ? (() => {
            const [cx, cy] = centroid(hovered.polygon) ?? [0.5, 0.5];
            const { title, line } = labelFor(hovered);
            return (
              <span
                className="glass pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-full px-3 py-1.5 text-xs font-medium text-foreground"
                style={{ left: rect.x + cx * rect.width, top: rect.y + cy * rect.height - 8 }}
              >
                {title}
                {line ? <span className="font-normal text-muted-foreground"> · {line}</span> : null}
              </span>
            );
          })()
        : null}
    </>
  );
}
