'use client';

import * as React from 'react';
import type { RoomFacts } from '@/components/rooms/room-facts';
import { coverRect, type Point } from '@/components/site/cover-fit';
import { Modal } from '@/components/site/modal';
import { useAnchoredCard, useMarkerAnchor } from '@/components/site/use-anchored-card';
import { useElementSize } from '@/components/site/use-element-size';
import { PHONE_QUERY, useMediaQuery } from '@/components/site/use-media-query';
import type { GuestSpinnerZone } from '@/lib/application/catalog-service';
import { withStayQuery } from '@/lib/application/search-params';
import type { BuildingSpinnerData, SpinnerHotspot } from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import { lRoomLine } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { buildTrack, frontOnPoint, hotspotPosition, openingFrame } from './orbit';
import { SpinnerMarker } from './spinner-marker';
import { SpinnerRoomCard, SpinnerRoomSheetBody } from './spinner-room-card';
import { SpinnerZonesOverlay } from './spinner-zones-overlay';
import { TurnControls } from './turn-controls';
import { useCanvasFrame, useFrameSequence } from './use-frame-sequence';
import { useFrameUrlSync } from './use-frame-url-sync';
import { useOrbit } from './use-orbit';

export interface BuildingSpinnerProps {
  spinner: BuildingSpinnerData;
  /** Zones drawn in `/admin/content/spinner` — see `SpinnerZonesOverlay`. Only ever shown on a key-angle frame. */
  zones?: GuestSpinnerZone[];
  /** The flat photo of the same view — shown, markers pinned front-on, if the frame sequence fails to load. */
  fallbackPhoto: { url: string; width: number; height: number; alt: string };
  title: string;
  /** The guest's dates, carried into whatever a hotspot links to. */
  stayQuery?: string;
  /** By room slug, for the hotspots that sell a room type. */
  rooms?: Record<string, RoomFacts>;
  /** Only the visible layer captures drag/keyboard — a hidden cross-fade layer must not. */
  active: boolean;
  /** Deep link: `/?frame=N`. */
  initialFrame?: number;
  /** Deep link: `/?unit=<slug>` — opens turned to a frame where that hotspot is visible. */
  focusHotspotId?: string | null;
  className?: string;
}

/**
 * Orbits around the *outside* of the building: a baked frame sequence
 * (`Hotel.spinner`) drawn to one canvas, with hotspots that only exist across
 * the frames where what they name faces the camera. See this module's
 * README.md for how the pieces fit, and SPINNER_SPEC.md for why a baked
 * sequence rather than a live 3D scene.
 *
 * This component only composes: frames load in `useFrameSequence`, turning is
 * `useOrbit`, the address bar is `useFrameUrlSync`, and every rule about where
 * the orbit or a hotspot is lives in `orbit.ts`.
 */
export function BuildingSpinner({
  spinner,
  zones,
  fallbackPhoto,
  title,
  stayQuery,
  rooms,
  active,
  initialFrame,
  focusHotspotId,
  className,
}: BuildingSpinnerProps) {
  const t = useT();
  const { locale } = useLocale();
  const { frameCount } = spinner;
  const frameSize = { width: spinner.frameWidth, height: spinner.frameHeight };
  const keyAngles = React.useMemo(() => [...spinner.keyAngles].sort((a, b) => a - b), [spinner.keyAngles]);

  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const markerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const stage = useElementSize(stageRef);
  // Below `sm` a storey opens the product's own sheet instead of a card
  // floating on the stage — the same swap `HotelScene` makes for its markers.
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [activeHotspot, setActiveHotspot] = React.useState<string | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = React.useState<string | null>(null);

  // Decided once, at mount: the deep link picks where the guest arrives, not where they are.
  const [opening] = React.useState(() =>
    openingFrame({
      frameCount,
      keyAngles,
      hotspots: spinner.hotspots,
      initialFrame,
      focusHotspotId,
      startFrame: spinner.startFrame,
    }),
  );
  const frames = useFrameSequence(spinner.frames, frameCount, opening);
  const orbit = useOrbit({
    frameCount,
    keyAngles,
    openingFrame: opening,
    enabled: active && !frames.hasError,
    onTurnStart: () => setActiveHotspot(null),
  });
  const { frameIndex } = orbit;
  useCanvasFrame(canvasRef, frames.readyImage(frameIndex), stage, frameSize);
  useFrameUrlSync(frameIndex, active);

  // Prepared once for the whole orbit; only the interpolation runs per frame.
  const tracks = React.useMemo(
    () => spinner.hotspots.map((hotspot) => ({ hotspot, track: buildTrack(hotspot, frameCount) })),
    [spinner.hotspots, frameCount],
  );
  const visible = React.useMemo(
    () =>
      tracks.flatMap(({ hotspot, track }) => {
        const position = hotspotPosition(track, frameIndex, frameCount);
        return position ? [{ hotspot, position }] : [];
      }),
    [tracks, frameIndex, frameCount],
  );

  // A zone only ever carries a polygon on the key-angle frame it was drawn
  // on (see `docs/decisions/0006-spinner-markup.md`) — no interpolation
  // between frames the way a marker's position gets.
  const zonesOnFrame = React.useMemo(
    () => (zones ?? []).filter((zone) => zone.frameIndex === frameIndex),
    [zones, frameIndex],
  );

  // A pinned card closes once its storey turns out of view.
  React.useEffect(() => {
    if (activeHotspot && !visible.some((entry) => entry.hotspot.id === activeHotspot)) setActiveHotspot(null);
  }, [visible, activeHotspot]);

  /** Hover previews the card; a click pins it, so it survives the pointer leaving. */
  const shownId = activeHotspot ?? hoveredHotspot;
  const anchor = useMarkerAnchor(stageRef, markerRefs, shownId, `${stage.width}x${stage.height}@${frameIndex}`);
  const { cardRef, style: cardStyle } = useAnchoredCard<HTMLAnchorElement>(anchor, stage);

  const shown = visible.find((entry) => entry.hotspot.id === shownId)?.hotspot ?? null;
  const factsFor = (hotspot: SpinnerHotspot) => (hotspot.roomSlug ? rooms?.[hotspot.roomSlug] : undefined);

  const rect = stage.width > 0 ? coverRect(frameSize, stage) : null;
  const positionFor = (point: Point): React.CSSProperties =>
    rect
      ? { left: rect.x + point.x * rect.width, top: rect.y + point.y * rect.height }
      : { left: `${point.x * 100}%`, top: `${point.y * 100}%` };

  const renderMarker = (hotspot: SpinnerHotspot, point: Point) => (
    <SpinnerMarker
      key={hotspot.id}
      hotspot={hotspot}
      line={lRoomLine(factsFor(hotspot), locale)}
      isActive={hotspot.id === activeHotspot}
      isHovered={hotspot.id === hoveredHotspot}
      style={positionFor(point)}
      buttonRef={(element) => {
        markerRefs.current[hotspot.id] = element;
      }}
      onSelect={() => {
        // A marker must not block the spin: a press that travelled was a drag.
        if (orbit.wasDrag()) return;
        setActiveHotspot((current) => (current === hotspot.id ? null : hotspot.id));
      }}
      onHoverChange={(hovering) => setHoveredHotspot(hovering ? hotspot.id : null)}
    />
  );

  const card =
    shown && !isPhone ? (
      <SpinnerRoomCard
        hotspot={shown}
        facts={factsFor(shown)}
        href={withStayQuery(shown.href, stayQuery)}
        cardRef={cardRef}
        style={cardStyle}
        onHover={() => setHoveredHotspot(shown.id)}
      />
    ) : null;

  const sheet = (
    <Modal
      open={Boolean(activeHotspot) && isPhone}
      onClose={() => setActiveHotspot(null)}
      title={(shown && factsFor(shown)?.name) ?? shown?.label ?? ''}
    >
      {shown ? (
        <SpinnerRoomSheetBody hotspot={shown} facts={factsFor(shown)} href={withStayQuery(shown.href, stayQuery)} />
      ) : null}
    </Modal>
  );

  // Frame sequence unusable: the still photo of the same view, with the same
  // markers pinned at their front-on position — no drag, no error banner.
  if (frames.hasError) {
    return (
      <div className={cn('relative size-full', className)}>
        <img
          src={fallbackPhoto.url}
          alt={fallbackPhoto.alt}
          width={fallbackPhoto.width}
          height={fallbackPhoto.height}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        {spinner.hotspots.map((hotspot) => renderMarker(hotspot, frontOnPoint(hotspot)))}
        {card}
        {sheet}
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      role="group"
      tabIndex={active ? 0 : -1}
      aria-roledescription="carousel"
      aria-label={`${title}, ${t('home.spinnerDragHint')}`}
      // `pan-y`, not `none`: the stage fills a phone's screen, and `none` made
      // it a dead zone the page could not be scrolled past. The drag only reads
      // horizontal travel, so a vertical swipe stays the browser's to scroll
      // (it cancels our pointer stream when it claims the gesture, which ends
      // the drag).
      className={cn('relative size-full touch-pan-y outline-none select-none', className)}
      {...orbit.stageHandlers}
    >
      <canvas ref={canvasRef} aria-label={title} className="pointer-events-none absolute inset-0 size-full" />

      <SpinnerZonesOverlay
        zones={zonesOnFrame}
        frameSize={frameSize}
        stage={stage}
        hidden={orbit.isTurning}
        stayQuery={stayQuery}
        rooms={rooms}
      />

      {orbit.isTurning ? null : visible.map(({ hotspot, position }) => renderMarker(hotspot, position))}

      {card}

      <TurnControls onTurn={orbit.turn} />

      {sheet}
    </div>
  );
}
