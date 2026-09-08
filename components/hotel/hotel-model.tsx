'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Bed, HandSwipeLeft, Ruler } from '@phosphor-icons/react/dist/ssr';
import type { HotelModelSceneHandle, SceneTokens } from '@/components/hotel/hotel-model-scene';
import { factTone, tintInk, tintSurface } from '@/components/rooms/feature-icon';
import { Modal } from '@/components/site/modal';
import type { HotelModel as HotelModelSpec, RoomOffer } from '@/lib/domain/schemas';
import { bedLabels, formatFloor, formatMoney } from '@/lib/formatting';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * The building, turnable, with its floors as the way into the catalog. A
 * drag turns it, a pinch or a wheel comes closer, a tap on a floor — or on
 * the rail beside the stage — names the rooms on that floor with tonight's
 * price and opens them. The scene itself is `hotel-model-scene.ts`, pulled
 * in only once the stage is near the viewport, so three.js never delays the
 * arrival photograph above it.
 */

/** A room type on one floor: what the floor's card may say, priced by the catalog. */
export interface FloorRoom {
  slug: string;
  name: string;
  areaM2: number;
  capacity: number;
  bedType: RoomOffer['room']['bedType'];
  nightlyPrice: number;
  currency: RoomOffer['price']['currency'];
  photo?: { url: string; width?: number; height?: number };
}

interface HotelModelProps {
  hotelName: string;
  model: HotelModelSpec;
  /** Bookable room types by floor; a floor missing here has nothing on sale. */
  roomsByFloor: Record<number, FloorRoom[]>;
  stayQuery?: string;
  className?: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

function readTokens(element: HTMLElement): SceneTokens {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    canvas: read('--canvas', '#f3f1ec'),
    stone: read('--stone', '#e9e5dd'),
    accent: read('--accent', '#b8603a'),
    ink: read('--ink', '#161616'),
  };
}

export function HotelModel({
  hotelName,
  model,
  roomsByFloor,
  stayQuery,
  className,
}: HotelModelProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const mountRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<HotelModelSceneHandle | null>(null);
  const [status, setStatus] = React.useState<Status>('idle');
  const [selected, setSelected] = React.useState<number | null>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [interacted, setInteracted] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // Below `sm` the floor's rooms open in the product's sheet: the stage is
  // barely taller than the card would be.
  const [isPhone, setIsPhone] = React.useState(false);

  const topFloor = Math.max(
    1,
    ...model.blocks.map((block) => block.toFloor),
    ...Object.keys(roomsByFloor).map(Number),
  );
  const floors = Array.from({ length: topFloor }, (_, index) => topFloor - index);

  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const apply = () => setIsPhone(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Build once the stage is near enough to matter, and tear down on unmount.
  // Keyed on the model's content, not its identity: the page re-renders with
  // a fresh object on every search, and the building has not changed.
  const modelKey = JSON.stringify(model);
  const modelRef = React.useRef(model);
  modelRef.current = model;
  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let handle: HotelModelSceneHandle | null = null;
    let themeObserver: MutationObserver | null = null;

    const build = async () => {
      setStatus('loading');
      try {
        const { createHotelModelScene } = await import('@/components/hotel/hotel-model-scene');
        if (cancelled) return;
        const dark = document.documentElement.classList.contains('dark');
        handle = await createHotelModelScene({
          container: mount,
          model: modelRef.current,
          tokens: readTokens(mount),
          dark,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          onHover: setHovered,
          onSelect: (floor) => setSelected((current) => (current === floor ? null : floor)),
          onInteract: () => setInteracted(true),
        });
        if (cancelled) {
          handle.dispose();
          return;
        }
        sceneRef.current = handle;
        setStatus('ready');

        // The scheme may have changed while the textures were loading.
        handle.setTheme(readTokens(mount), document.documentElement.classList.contains('dark'));

        // The scheme lives on <html>; follow it if it changes under us.
        themeObserver = new MutationObserver(() => {
          handle?.setTheme(readTokens(mount), document.documentElement.classList.contains('dark'));
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class'],
        });
      } catch (error) {
        console.error('Hotel model failed to build', error);
        if (!cancelled) setStatus('error');
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void build();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(mount);

    return () => {
      cancelled = true;
      observer.disconnect();
      themeObserver?.disconnect();
      handle?.dispose();
      sceneRef.current = null;
    };
  }, [modelKey]);

  React.useEffect(() => {
    sceneRef.current?.setSelected(selected);
  }, [selected, status]);

  React.useEffect(() => {
    sceneRef.current?.setHovered(hovered);
  }, [hovered, status]);

  const toggleFullscreen = async () => {
    const element = stageRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Fullscreen is a progressive enhancement; ignore refusals (iOS Safari).
    }
  };

  const roomHref = (slug: string) => (stayQuery ? `/rooms/${slug}?${stayQuery}` : `/rooms/${slug}`);
  const selectedRooms = selected === null ? [] : (roomsByFloor[selected] ?? []);

  /** The floor's rooms as rows: name, tonight's price, the way in. */
  const roomRows = (rooms: FloorRoom[], detailed: boolean) =>
    rooms.length === 0 ? (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Nothing on this floor is bookable for these dates. Try another floor, or another stay.
      </p>
    ) : (
      <ul className="flex flex-col divide-y divide-border">
        {rooms.map((room) => (
          <li key={room.slug}>
            <Link
              href={roomHref(room.slug)}
              className="flex items-center gap-3 py-2.5 transition-colors first:pt-0 last:pb-0 hover:text-accent-strong"
            >
              {detailed && room.photo ? (
                <img
                  src={room.photo.url}
                  alt=""
                  width={room.photo.width}
                  height={room.photo.height}
                  loading="lazy"
                  decoding="async"
                  className="size-14 shrink-0 rounded-[14px] object-cover"
                />
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                <span className="font-medium">{room.name}</span>
                <span className="text-xs text-muted-foreground">
                  from {formatMoney(room.nightlyPrice, room.currency)} a night
                </span>
                {detailed ? (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className={tag(tintSurface[factTone.area])}>
                      <Ruler
                        weight="fill"
                        className={cn('size-3.5', tintInk[factTone.area])}
                        aria-hidden="true"
                      />
                      {room.areaM2} m²
                    </span>
                    <span className={tag(tintSurface[factTone.bed])}>
                      <Bed
                        weight="fill"
                        className={cn('size-3.5', tintInk[factTone.bed])}
                        aria-hidden="true"
                      />
                      {bedLabels[room.bedType]}
                    </span>
                  </span>
                ) : null}
              </span>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );

  /** One floor on the rail, lit when it is the one named on the model. */
  const floorButton = (floor: number) => {
    const count = roomsByFloor[floor]?.length ?? 0;
    const lit = selected === floor || hovered === floor;
    return (
      <button
        key={floor}
        type="button"
        aria-pressed={selected === floor}
        aria-label={`${formatFloor(floor)}, ${count === 1 ? "1 room type" : `${count} room types`}`}
        onClick={() => setSelected((current) => (current === floor ? null : floor))}
        onMouseEnter={() => setHovered(floor)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(floor)}
        onBlur={() => setHovered(null)}
        className={cn(
          'grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-sm font-medium tabular-nums transition-colors sm:size-9',
          selected === floor
            ? 'bg-primary text-primary-foreground'
            : lit
              ? 'glass text-accent-strong'
              : count > 0
                ? 'glass text-foreground hover:bg-glass-tint/90'
                : 'glass text-muted-foreground hover:bg-glass-tint/90',
        )}
      >
        {floor}
      </button>
    );
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={stageRef}
        role="group"
        aria-label={`${hotelName} as a model you can turn. ${topFloor} floors.`}
        className="relative aspect-[4/3] overflow-hidden bg-stone sm:aspect-[16/10] sm:rounded-[28px]"
      >
        {/* The canvas lands here. `touch-none` on the stage itself, so a
            finger that starts on the model turns it rather than the page. */}
        <div
          ref={mountRef}
          role="img"
          aria-label={`3D model of ${hotelName}. Drag to turn, pinch to zoom.`}
          className="absolute inset-0 touch-none"
        />

        {status === 'loading' || status === 'idle' ? (
          <p
            aria-live="polite"
            className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground"
          >
            {status === 'loading' ? 'Building the model…' : ''}
          </p>
        ) : null}

        {status === 'error' ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="flex max-w-xs flex-col items-center gap-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                This browser can't draw the model. The photographs above show the same building.
              </p>
              <Link
                href={stayQuery ? `/rooms?${stayQuery}` : '/rooms'}
                className={pill('secondary', 'h-10 px-4')}
              >
                Browse the rooms
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : null}

        {/* How to hold it, until the guest has. */}
        {status === 'ready' && !interacted ? (
          <p className="glass pointer-events-none absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full py-2 pr-3.5 pl-3 text-sm font-medium">
            <HandSwipeLeft weight="fill" className="size-4 text-accent" aria-hidden="true" />
            <span className="sm:hidden">Drag to turn</span>
            <span className="hidden sm:inline">Drag to turn · scroll to zoom</span>
          </p>
        ) : null}

        <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
          {status === 'ready' ? (
            <button
              type="button"
              aria-label="Reset the view"
              onClick={() => {
                sceneRef.current?.resetView();
                setSelected(null);
              }}
              className={iconButton('glass')}
            >
              <ArrowPathIcon className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
            onClick={toggleFullscreen}
            className={iconButton('glass')}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="size-5" aria-hidden="true" />
            ) : (
              <ArrowsPointingOutIcon className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* The floors, top down, beside the building from `sm`. A phone gets
            the same rail under the stage, where it does not cover the model. */}
        <div
          role="group"
          aria-label="Floors"
          className="absolute top-1/2 right-4 z-10 hidden -translate-y-1/2 flex-col gap-1.5 sm:flex"
        >
          {floors.map(floorButton)}
        </div>

        {/* On a desk the floor's rooms open at the foot of the stage. */}
        {selected !== null && !isPhone ? (
          <div
            aria-live="polite"
            className="glass absolute bottom-4 left-4 z-20 w-[min(22rem,calc(100%-2rem))] rounded-3xl p-4 text-foreground shadow-soft-lg"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-medium">{formatFloor(selected)}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelected(null)}
                className={iconButton('glass', 'size-8')}
              >
                <XMarkIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
            {roomRows(selectedRooms, false)}
          </div>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Floors"
        className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto px-3 sm:hidden"
      >
        {floors.map(floorButton)}
      </div>

      <Modal
        open={selected !== null && isPhone}
        onClose={() => setSelected(null)}
        title={selected === null ? '' : formatFloor(selected)}
      >
        {selected !== null ? (
          <div className="flex flex-col">
            <h3 className="text-display text-2xl">{formatFloor(selected)}</h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              {selectedRooms.length === 0
                ? 'Nothing bookable here for these dates.'
                : selectedRooms.length === 1
                  ? 'One room type on this floor.'
                  : `${selectedRooms.length} room types on this floor.`}
            </p>
            {roomRows(selectedRooms, true)}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
