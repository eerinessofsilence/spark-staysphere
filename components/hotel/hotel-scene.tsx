'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Anchor,
  Bed,
  Bell,
  Car,
  Drop,
  MapPin,
  Ruler,
  Sparkle,
  SwimmingPool,
  Waves,
  Wine,
} from '@phosphor-icons/react/dist/ssr';
import {
  ArrowRightIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { BuildingSpinner } from '@/components/hotel/building-spinner';
import { useAnchoredCard, type CardAnchor } from '@/components/hotel/use-anchored-card';
import { factTone, tintInk, tintSurface } from '@/components/rooms/feature-icon';
import { Modal } from '@/components/site/modal';
import type { BuildingSpinnerData, HotelArea, Hotspot, RoomOffer } from '@/lib/domain/schemas';
import { bedLabels, formatFloor, formatMoney, formatRoomLine } from '@/lib/formatting';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';

/** The one `HotelArea` a `spinner` replaces the flat photo of — see `SPINNER_SPEC.md`. */
const SPINNER_AREA_ID = 'hotel';

/**
 * The arrival screen: photography of the property, one area at a time, with
 * hotspots that lead into the catalog and, on the facade, the floors traced so
 * a hover names the room. Positions are stored as fractions of the photo and
 * mapped through the same cover-crop the browser applies, so a marker stays on
 * the balcony it points at whatever the viewport. The 360° tour lives beside
 * this, in `PanoramaTour`.
 */

const hotspotIcons: Record<string, typeof MapPin> = {
  'sea-view': Waves,
  cove: Anchor,
  infinity: SwimmingPool,
  pavilion: Wine,
  hydro: Drop,
  treatment: Sparkle,
  reception: Bell,
  transfer: Car,
};

/** What a marker can say about the room it sells; priced by the catalog, never here. */
export interface RoomFacts {
  name: string;
  areaM2: number;
  floor: number;
  capacity: number;
  bedType: RoomOffer['room']['bedType'];
  nightlyPrice: number;
  currency: RoomOffer['price']['currency'];
  status?: RoomOffer['status'];
  remaining?: number;
  /** The room's cover, so a phone's sheet can show what the marker points at. */
  photo?: { url: string; width?: number; height?: number };
}

interface HotelSceneProps {
  areas: HotelArea[];
  location: string;
  /** Query string appended to hotspot links so the stay survives navigation. */
  stayQuery?: string;
  /** By room slug, for the markers that point at a room type. */
  rooms?: Record<string, RoomFacts>;
  /** Replaces the `SPINNER_AREA_ID` area's flat photo with a draggable orbit. */
  spinner?: BuildingSpinnerData;
  /** Deep link: `/?frame=N`. */
  spinnerInitialFrame?: number;
  /** Deep link: `/?unit=<slug>`, opens turned to a frame where that hotspot is visible. */
  spinnerFocusHotspotId?: string | null;
  className?: string;
}

/** `object-fit: cover`: the photo's scale and centring, applied to a fraction of it. */
function projectOnto(
  point: { x: number; y: number },
  photo: { width: number; height: number },
  dims: { width: number; height: number },
) {
  const scale = Math.max(dims.width / photo.width, dims.height / photo.height);
  return {
    x: (dims.width - photo.width * scale) / 2 + point.x * photo.width * scale,
    y: (dims.height - photo.height * scale) / 2 + point.y * photo.height * scale,
  };
}

export function HotelScene({
  areas,
  location,
  stayQuery,
  rooms,
  spinner,
  spinnerInitialFrame,
  spinnerFocusHotspotId,
  className,
}: HotelSceneProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const [activeHotspot, setActiveHotspot] = React.useState<string | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = React.useState<string | null>(null);
  const [dims, setDims] = React.useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // iOS Safari has no Fullscreen API for anything but a `<video>` element —
  // `element.requestFullscreen` either doesn't exist or returns a promise
  // that never settles — so the button falls back to a CSS overlay there,
  // which gets the same "off with the chrome" effect on every browser.
  const [fakeFullscreen, setFakeFullscreen] = React.useState(false);
  const [hoveredZone, setHoveredZone] = React.useState<string | null>(null);
  // Below `sm` a marker opens the product's sheet instead of a card floating
  // on a 275px-tall photograph. Read after mount, which is always before a
  // marker can have been pressed.
  const [isPhone, setIsPhone] = React.useState(false);
  const [pinnedZone, setPinnedZone] = React.useState<string | null>(null);
  const markerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeAnchor, setActiveAnchor] = React.useState<CardAnchor | null>(null);

  React.useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The card's anchor is measured off the real marker, not guessed from its
  // usual size: a marker carrying a room's floor and price can run to two
  // lines, and a guessed height there would undersell how tall it actually is
  // — exactly the gap a clamp can't make up for, so the card ends up over it.
  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    const marker = activeHotspot ? markerRefs.current[activeHotspot] : null;
    if (!stage || !marker) {
      setActiveAnchor(null);
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    setActiveAnchor({
      x: markerRect.left - stageRect.left + markerRect.width / 2,
      top: markerRect.top - stageRect.top,
      bottom: markerRect.bottom - stageRect.top,
    });
  }, [activeHotspot, dims.width, dims.height]);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // The overlay's own escape hatch: Escape closes it, and the page behind it
  // must not scroll under it while it's up — the native API gets both for
  // free, so only the fallback needs to do this itself.
  React.useEffect(() => {
    if (!fakeFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFakeFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [fakeFullscreen]);

  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const apply = () => setIsPhone(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  /**
   * With an orbit available the arrival stage is the orbit and nothing else:
   * no other area's photograph, no name badge, no paging. The remaining areas
   * stay in the catalog for the rooms and the 360° tour to use.
   */
  const spinnerIndex = areas.findIndex((candidate) => candidate.id === SPINNER_AREA_ID);
  const spinnerOnly = Boolean(spinner) && spinnerIndex >= 0;
  const area = spinnerOnly ? areas[spinnerIndex]! : (areas[index] ?? areas[0]);
  // A marker sits inside the floor band it belongs to, so hovering it also
  // hovers the band underneath — without this, its pill and the band's own
  // price card land in the same spot and read as one broken tangle. The
  // marker wins: it is the more specific target, and the band's card returns
  // the moment the pointer clears it.
  const namedZone = hoveredHotspot || activeHotspot ? null : (pinnedZone ?? hoveredZone);

  // The floor band's card hangs off the middle of the band. It used to be
  // centred there with a transform and nothing else, so on a phone — where the
  // stage is barely wider than the card — half of it hung off the left edge.
  // Same hook as the marker's card: measured, clamped, and pinned to the bottom
  // rail when neither side of the anchor has room for it.
  const zone =
    area && namedZone ? (area.roomZones?.find((entry) => entry.roomSlug === namedZone) ?? null) : null;
  const zoneAnchor: CardAnchor | null =
    zone && area && dims.width > 0
      ? (() => {
          const centre = projectOnto(
            {
              x: zone.outline.reduce((sum, point) => sum + point.x, 0) / zone.outline.length,
              y: zone.outline.reduce((sum, point) => sum + point.y, 0) / zone.outline.length,
            },
            area.photo,
            dims,
          );
          return { x: centre.x, top: centre.y, bottom: centre.y };
        })()
      : null;

  // Both hooks have to run on every render, ahead of the early return below.
  const { cardRef: activeCardRef, style: activeCardStyle } = useAnchoredCard(activeAnchor, dims);
  const { cardRef: zoneCardRef, style: zoneCardStyle } = useAnchoredCard<HTMLAnchorElement>(
    zoneAnchor,
    dims,
  );

  if (!area) return null;

  // The spinner owns this area's hotspots and floor bands itself (per-frame
  // visibility neither the generic outline overlay nor the flat-photo
  // `roomZones` bands account for) — see `SPINNER_SPEC.md`'s "Target mechanic".
  const isSpinnerArea = area.id === SPINNER_AREA_ID && Boolean(spinner);

  const go = (next: number) => {
    setIndex((next + areas.length) % areas.length);
    setActiveHotspot(null);
    setPinnedZone(null);
  };

  /** Floor and tonight's price for a marker that sells a room, as one short line. */
  const roomLine = (hotspot: Hotspot): string | null =>
    formatRoomLine(hotspot.roomSlug ? rooms?.[hotspot.roomSlug] : undefined);

  const toggleFullscreen = async () => {
    const element = stageRef.current;
    if (!element) return;
    if (fakeFullscreen) {
      setFakeFullscreen(false);
      return;
    }
    if (typeof element.requestFullscreen !== 'function' || document.fullscreenEnabled === false) {
      setFakeFullscreen(true);
      return;
    }
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Still refused (Safari's own permission prompt, an embedded webview,
      // …) — the overlay is the fallback of last resort.
      setFakeFullscreen(true);
    }
  };

  const project = (point: { x: number; y: number }) => projectOnto(point, area.photo, dims);

  /** A marker's place, as a style; percentages until the stage has been measured. */
  const positionFor = (hotspot: Hotspot): React.CSSProperties => {
    if (!dims.width || !dims.height) {
      return { left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` };
    }
    const { x, y } = project(hotspot);
    return { left: x, top: y };
  };

  const hotspotHref = (hotspot: Hotspot): string => {
    const [path, query] = hotspot.href.split('?');
    const params = new URLSearchParams(query ?? '');
    if (stayQuery) new URLSearchParams(stayQuery).forEach((value, key) => params.set(key, value));
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  };

  const active = isSpinnerArea ? null : (area.hotspots.find((hotspot) => hotspot.id === activeHotspot) ?? null);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={stageRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={
          spinnerOnly ? `${area.name}, 360° view` : `Explore the hotel area by area. ${areas.length} areas.`
        }
        // Fills the screen below the header on a phone — 5rem is that
        // header's own height (h-14 + its pt-3) plus this section's pt-3
        // above the stage; update it if either changes. The frames are 16:9
        // against a portrait screen, so covering this box crops their sides
        // hard: the building is a wide, low slab and a phone is tall, and
        // there is no scale that fits all of one into the other. Full bleed
        // wins over bars. The 28px card returns from `sm`, where the stage is
        // wider than tall again, and the fallback overlay drops all of it.
        className={cn(
          'relative h-[calc(100svh-5rem)] overflow-hidden bg-stone sm:aspect-[16/10] sm:h-auto sm:rounded-[28px]',
          fakeFullscreen && 'fixed inset-0 z-50 h-auto aspect-auto rounded-none sm:aspect-auto sm:rounded-none',
        )}
      >
        {/* All areas are stacked so switching is instant; only one is visible. */}
        {(spinnerOnly ? [area] : areas).map((candidate, candidateIndex) => (
          <div
            key={candidate.id}
            aria-hidden={!spinnerOnly && candidateIndex !== index}
            className={cn(
              'absolute inset-0 size-full transition-opacity duration-500',
              spinnerOnly || candidateIndex === index ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            {candidate.id === SPINNER_AREA_ID && spinner ? (
              <BuildingSpinner
                spinner={spinner}
                fallbackPhoto={candidate.photo}
                title={candidate.name}
                stayQuery={stayQuery}
                rooms={rooms}
                active={spinnerOnly || candidateIndex === index}
                initialFrame={spinnerInitialFrame}
                focusHotspotId={spinnerFocusHotspotId}
              />
            ) : (
              <img
                src={candidate.photo.url}
                alt={candidateIndex === index ? candidate.photo.alt : ''}
                width={candidate.photo.width}
                height={candidate.photo.height}
                decoding="async"
                fetchPriority={candidateIndex === 0 ? 'high' : 'auto'}
                className="size-full object-cover"
              />
            )}
          </div>
        ))}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent"
        />

        <button
          type="button"
          aria-label={isFullscreen || fakeFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
          onClick={toggleFullscreen}
          className={iconButton('glass', 'absolute top-4 right-4 z-20')}
        >
          {isFullscreen || fakeFullscreen ? (
            <ArrowsPointingInIcon className="size-5" aria-hidden="true" />
          ) : (
            <ArrowsPointingOutIcon className="size-5" aria-hidden="true" />
          )}
        </button>

        {/* The part of the building a marker stands for, traced on the photo
            and lit on hover — the way a plan lets you point at a wing. */}
        {!isSpinnerArea && dims.width > 0 ? (
          <svg className="pointer-events-none absolute inset-0 z-[5] size-full" aria-hidden="true">
            {area.hotspots
              .filter((hotspot) => hotspot.outline)
              .map((hotspot) => {
                const lit = hoveredHotspot === hotspot.id || activeHotspot === hotspot.id;
                return (
                  <polygon
                    key={hotspot.id}
                    points={hotspot
                      .outline!.map((point) => {
                        const { x, y } = project(point);
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    onMouseEnter={() => setHoveredHotspot(hotspot.id)}
                    onMouseLeave={() => setHoveredHotspot(null)}
                    onClick={() => setActiveHotspot((current) => (current === hotspot.id ? null : hotspot.id))}
                    className={cn(
                      'pointer-events-auto cursor-pointer transition-[fill,stroke] duration-200',
                      // Clay is the accent for active states; the shadow keeps the
                      // line readable where the facade itself is white.
                      lit
                        ? 'fill-white/20 stroke-accent [filter:drop-shadow(0_1px_4px_rgb(22_22_22/0.45))]'
                        : 'fill-transparent stroke-transparent',
                    )}
                  />
                );
              })}
          </svg>
        ) : null}

        {/* Room zones: the floors of the building, traced on the photo. Hover
            names the room, its floor and its price; a click pins that and
            offers the way in. Superseded by the spinner's own markers on its
            area — a floor band traced against the frame-0 photo would drift
            off the building the moment the guest drags to another angle. */}
        {!isSpinnerArea && dims.width > 0 && area.roomZones && rooms ? (
          <>
            <svg className="pointer-events-none absolute inset-0 z-[6] size-full" aria-hidden="true">
              {area.roomZones.map((zone) => {
                const lit = namedZone === zone.roomSlug;
                return (
                  <polygon
                    key={zone.roomSlug}
                    points={zone.outline
                      .map((point) => {
                        const { x, y } = project(point);
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    onMouseEnter={() => setHoveredZone(zone.roomSlug)}
                    onMouseLeave={() => setHoveredZone(null)}
                    onClick={() => setPinnedZone((current) => (current === zone.roomSlug ? null : zone.roomSlug))}
                    className={cn(
                      'pointer-events-auto cursor-pointer transition-[fill,stroke] duration-200',
                      lit
                        ? 'fill-white/20 stroke-accent [filter:drop-shadow(0_1px_4px_rgb(22_22_22/0.45))]'
                        : 'fill-transparent stroke-white/40',
                    )}
                  />
                );
              })}
            </svg>

            {area.roomZones
              .filter((zone) => zone.roomSlug === namedZone && rooms[zone.roomSlug])
              .map((zone) => {
                // Placed by `zoneAnchor` above: the band's centre, then clamped
                // onto the stage like the marker's card.
                const facts = rooms[zone.roomSlug]!;
                return (
                  <Link
                    key={zone.roomSlug}
                    href={stayQuery ? `/rooms/${zone.roomSlug}?${stayQuery}` : `/rooms/${zone.roomSlug}`}
                    onMouseEnter={() => setHoveredZone(zone.roomSlug)}
                    onMouseLeave={() => setHoveredZone(null)}
                    ref={zoneCardRef}
                    style={zoneCardStyle}
                    // Above the markers: they share z-10, so DOM order used to
                    // let a marker paint straight through the card's price.
                    className="glass absolute z-20 flex max-w-[min(22rem,calc(100%-2rem))] items-center gap-3 rounded-3xl py-2.5 pr-2.5 pl-4 text-sm shadow-soft"
                  >
                    <span className="flex flex-col gap-1 leading-tight">
                      <span className="font-medium">{facts.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatFloor(facts.floor)} · from {formatMoney(facts.nightlyPrice, facts.currency)}
                      </span>
                      <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Ruler weight="fill" className="size-3" aria-hidden="true" />
                          {facts.areaM2} m²
                        </span>
                        <span className="flex items-center gap-1">
                          <Bed weight="fill" className="size-3" aria-hidden="true" />
                          {bedLabels[facts.bedType]}
                        </span>
                        <span className="flex items-center gap-1">
                          <UsersIcon className="size-3" aria-hidden="true" />
                          Sleeps {facts.capacity}
                        </span>
                      </span>
                    </span>
                    <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                      <ArrowRightIcon className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
          </>
        ) : null}

        {(isSpinnerArea ? [] : area.hotspots).map((hotspot) => {
          const isActive = hotspot.id === activeHotspot;
          const Icon = hotspotIcons[hotspot.id] ?? MapPin;
          const line = roomLine(hotspot);
          return (
            <button
              key={hotspot.id}
              ref={(element) => {
                markerRefs.current[hotspot.id] = element;
              }}
              type="button"
              aria-pressed={isActive}
              aria-label={[hotspot.label, line].filter(Boolean).join(', ')}
              onClick={() => setActiveHotspot(isActive ? null : hotspot.id)}
              onMouseEnter={() => setHoveredHotspot(hotspot.id)}
              onMouseLeave={() => setHoveredHotspot(null)}
              style={positionFor(hotspot)}
              // A marker's fixed spot on the facade and a floor band's card
              // are placed by two systems that know nothing of each other —
              // a card anchored to its own band's centre can still land right
              // on a marker sitting nearby. Rather than teach either system
              // about the other's box, the marker steps aside, the same way
              // the caption already does while a band is named.
              tabIndex={namedZone ? -1 : undefined}
              className={cn(
                'absolute z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-2.5 rounded-full p-1 pr-1 text-sm font-medium transition-[opacity,colors] sm:pr-4',
                namedZone ? 'pointer-events-none opacity-0' : 'opacity-100',
                isActive ? 'bg-primary text-primary-foreground' : 'glass text-foreground hover:bg-glass-tint/90',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-9 place-items-center rounded-full',
                  isActive ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-primary text-primary-foreground',
                )}
              >
                <Icon weight="fill" className="size-4" />
              </span>
              <span className="hidden sm:inline">
                {hotspot.label}
                {line ? (
                  <span className={cn('font-normal', isActive ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {' '}· {line}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}

        {/* On a desk the card opens right beside the marker that was pressed,
            tracked by `useAnchoredCard` — never a fixed corner to hunt for.
            A phone gets the sheet below instead: there is no room beside a
            marker when the stage is barely taller than the card. */}
        {active && !isPhone ? (
          <div
            ref={activeCardRef}
            aria-live="polite"
            style={activeCardStyle}
            className="glass absolute z-30 max-w-[min(22rem,calc(100%-2rem))] rounded-3xl p-4 text-foreground shadow-soft-lg"
          >
            <p className="font-medium">{active.label}</p>
            {roomLine(active) ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {rooms?.[active.roomSlug!]?.name} · {roomLine(active)}
              </p>
            ) : null}
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {active.description}
            </p>
            <Link href={hotspotHref(active)} className={pill('primary', 'mt-3 h-10 px-4')}>
              {active.cta}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null}

        {/* Bottom rail: caption on the left, paging on the right. */}
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-end justify-between gap-3">
          <div aria-live="polite" className="max-w-[min(24rem,100%)]">
            {active || namedZone || spinnerOnly ? null : (
              // The caption steps aside while a floor is named: the lowest
              // band's label lands exactly where the caption sits. With the
              // spinner active it steps aside for good — the turn controls
              // sit in that same spot, and the location is still readable
              // just below, in the About section.
              <div className="flex flex-col gap-2 text-white">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs backdrop-blur-sm">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {location}
                </span>
                <p className="hidden max-w-md text-sm leading-relaxed text-white/85 sm:block">
                  {area.description}
                </p>
              </div>
            )}
          </div>

          {spinnerOnly ? null : (
            <div className="pointer-events-auto flex items-center gap-1 text-white">
              <button
                type="button"
                aria-label="Previous area"
                onClick={() => go(index - 1)}
                className={iconButton('glass', 'text-foreground')}
              >
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next area"
                onClick={() => go(index + 1)}
                className={iconButton('glass', 'text-foreground')}
              >
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* The phone's version of the marker card: the product's own sheet, with
          room for the prose the floating card had to drop. */}
      <Modal
        open={Boolean(active) && isPhone}
        onClose={() => setActiveHotspot(null)}
        title={active?.label ?? ''}
      >
        {active ? (
          <div className="flex flex-col">
            {(() => {
              const facts = active.roomSlug ? rooms?.[active.roomSlug] : undefined;
              // A marker that points at a room shows the room; one that points
              // at a place shows the place the guest was just looking at.
              const image = facts?.photo
                ? { url: facts.photo.url, alt: facts.name, width: facts.photo.width, height: facts.photo.height }
                : { url: area.photo.url, alt: area.photo.alt, width: area.photo.width, height: area.photo.height };
              return (
                <>
                  <img
                    src={image.url}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    className="aspect-[3/2] w-full rounded-[20px] object-cover"
                  />

                  <h3 className="text-display mt-5 text-2xl">{active.label}</h3>
                  {facts ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {facts.name} · {roomLine(active)}
                    </p>
                  ) : null}
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    {active.description}
                  </p>

                  {facts ? (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      <li className={tag(tintSurface[factTone.area])}>
                        <Ruler weight="fill" className={cn('size-3.5', tintInk[factTone.area])} aria-hidden="true" />
                        {facts.areaM2} m²
                      </li>
                      <li className={tag(tintSurface[factTone.bed])}>
                        <Bed weight="fill" className={cn('size-3.5', tintInk[factTone.bed])} aria-hidden="true" />
                        {bedLabels[facts.bedType]}
                      </li>
                      <li className={tag(tintSurface[factTone.capacity])}>
                        <UsersIcon className={cn('size-3.5', tintInk[factTone.capacity])} aria-hidden="true" />
                        Sleeps {facts.capacity}
                      </li>
                    </ul>
                  ) : null}

                  <Link
                    href={hotspotHref(active)}
                    // Straight after what it acts on. Pinned to the floor of
                    // a full screen it sat a long empty gap below the facts.
                    className={pill('primary', 'mt-6 min-h-12 w-full justify-center')}
                  >
                    {active.cta}
                    <ArrowRightIcon className="size-4" aria-hidden="true" />
                  </Link>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
