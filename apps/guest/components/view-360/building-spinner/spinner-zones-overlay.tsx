'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RoomFacts } from '@/components/rooms/room-facts';
import { coverRect, type Size } from '@/components/site/cover-fit';
import type { GuestSpinnerZone } from '@/lib/application/guest-contracts';
import { withStayQuery } from '@/lib/application/search-params';
import { centroid, toPathData } from '@/lib/domain/polygon/geometry';
import { useLocale, useT } from '@/lib/i18n/context';
import { lRoomLine } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

/**
 * The zones drawn in the PMS spinner editor, traced on the frame the building
 * is currently stopped on. A zone only exists on a key-angle frame, so
 * `zones` is pre-filtered to the current frame — nothing here reads
 * `frameIndex` itself.
 *
 * Marked stops show quiet outlines; hover or keyboard focus adds the lime
 * highlight. Other zones stay faint while one is highlighted. A label chip
 * follows the outline's centroid; a click goes straight to the zone's
 * target — there's no anchored preview card here the way a pinned marker
 * gets one, since a zone's shape is already the affordance.
 */
export function SpinnerZonesOverlay({
  zones,
  frameSize,
  stage,
  hidden,
  alwaysVisible = false,
  stayQuery,
  rooms,
}: {
  zones: GuestSpinnerZone[];
  frameSize: Size;
  stage: Size;
  /** True while the building is turning — zones hide the same way markers do. */
  hidden: boolean;
  /** Keep marked key angles' room outlines visible as a selection hint. */
  alwaysVisible?: boolean;
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
      <svg className="pointer-events-none absolute inset-0 z-[5] size-full text-[#d4ff3a]" role="group" aria-label={t('rooms.chooseYourRoom')}>
        <g transform={`translate(${rect.x} ${rect.y}) scale(${rect.width / frameSize.width} ${rect.height / frameSize.height})`}>
          {zones.map((zone) => {
            const lit = zone.id === hoveredId;
            const { title } = labelFor(zone);
            return (
              <path
                key={zone.id}
                data-testid="spinner-zone"
                d={toPathData(zone.polygon, frameSize.width, frameSize.height)}
                strokeWidth={lit ? 1.5 : 1}
                vectorEffect="non-scaling-stroke"
                strokeOpacity={lit ? 1 : hovered ? 0.18 : 0.4}
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
                  'pointer-events-auto cursor-pointer transition-[fill,stroke,stroke-opacity,stroke-width] duration-150 focus-visible:outline-none',
                  lit
                    ? 'fill-current/15 stroke-current'
                    : alwaysVisible
                      ? 'fill-transparent stroke-white'
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
                style={{ left: rect.x + cx * rect.width, top: rect.y + cy * rect.height - 24 }}
              >
                <span className="block text-center font-semibold">{title}</span>
                {line ? <span className="block font-normal text-muted-foreground">{line}</span> : null}
              </span>
            );
          })()
        : null}
    </>
  );
}
