'use client';

import * as React from 'react';
import { Maximize2, Minimize2, Move, RotateCcw } from 'lucide-react';
import { hasMedia } from '@/lib/domain/room-attributes';
import type { RoomType } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';
import { MediaBadges } from './media-badges';
import { RoomVisual, roomZones, zoneLabels, type RoomZone } from './room-visual';

/**
 * Zone switcher plus a simulated 360° pan. The pan is a horizontal camera on the
 * procedural artwork, not a photographic tile set — labelled as a preview so the
 * demo never overstates what is wired up.
 */
export function RoomGallery({ room }: { room: RoomType }) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [zone, setZone] = React.useState<RoomZone>('bedroom');
  const [panning, setPanning] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const drag = React.useRef<{ pointerId: number; startX: number; startOffset: number } | null>(null);

  // A studio has no separate living area; everything else does above 55 m².
  const zones = roomZones.filter((candidate) => candidate !== 'living' || room.areaM2 >= 55);
  const supports360 = hasMedia(room, '360');

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panning || event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startOffset: offset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const width = event.currentTarget.clientWidth || 1;
    const next = state.startOffset + ((event.clientX - state.startX) / width) * 100;
    setOffset(Math.max(-18, Math.min(18, next)));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleFullscreen = async () => {
    const element = stageRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Progressive enhancement only.
    }
  };

  return (
    <figure className="m-0">
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink sm:aspect-[16/10]',
          panning && 'cursor-grab touch-pan-y active:cursor-grabbing',
        )}
      >
        <div
          className="size-full transition-transform duration-200"
          style={{
            transform: panning ? `scale(1.25) translateX(${offset * 0.6}%)` : undefined,
          }}
        >
          <RoomVisual room={room} zone={zone} />
        </div>

        <MediaBadges room={room} className="absolute top-3 left-3" />

        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-2xl border border-[#F2F1EC]/15 bg-ink/75 p-1 backdrop-blur-sm">
          {supports360 ? (
            <button
              type="button"
              aria-pressed={panning}
              onClick={() => {
                setPanning((value) => !value);
                setOffset(0);
              }}
              className={cn(
                'flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors',
                panning ? 'bg-cyan text-ink' : 'text-[#F2F1EC] hover:bg-[#F2F1EC]/12',
              )}
            >
              <Move className="size-4" aria-hidden="true" />
              360° preview
            </button>
          ) : null}
          {panning ? (
            <button
              type="button"
              aria-label="Recentre the 360° preview"
              onClick={() => setOffset(0)}
              className="flex size-11 items-center justify-center rounded-xl text-[#F2F1EC] hover:bg-[#F2F1EC]/12"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
            onClick={toggleFullscreen}
            className="flex size-11 items-center justify-center rounded-xl text-[#F2F1EC] hover:bg-[#F2F1EC]/12"
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {panning ? (
          <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1.5 text-[11px] text-[#A4ABAC]">
            Drag to pan. Simulated preview, not a photographic 360.
          </p>
        ) : null}
      </div>

      <figcaption className="sr-only">
        Illustrated zones of the {room.name}. Use the buttons below to switch zone.
      </figcaption>

      <div role="tablist" aria-label="Room zones" className="mt-3 flex flex-wrap gap-2">
        {zones.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={zone === candidate}
            onClick={() => setZone(candidate)}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-2xl border px-3.5 text-sm font-medium transition-colors',
              zone === candidate
                ? 'border-ink bg-ink text-[#F2F1EC]'
                : 'border-border bg-card hover:bg-canvas',
            )}
          >
            <span className="size-10 shrink-0 overflow-hidden rounded-xl bg-ink">
              <RoomVisual room={room} zone={candidate} />
            </span>
            {zoneLabels[candidate]}
          </button>
        ))}
      </div>
    </figure>
  );
}
