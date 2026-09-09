'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Bed, MapPin, Ruler } from '@phosphor-icons/react/dist/ssr';
import { useAnchoredCard, type CardAnchor } from '@/components/hotel/use-anchored-card';
import type { BuildingSpinnerData, Currency, RoomStatus, SpinnerHotspot } from '@/lib/domain/schemas';
import { bedLabels, formatMoney, formatRoomLine, statusText } from '@/lib/formatting';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * Orbits around the *outside* of the building — drop-in for the flat photo
 * `HotelScene` shows for its facade/roof/cove area (see `SPINNER_AREA_ID` in
 * `hotel-scene.tsx`). Distinct from `PanoramaViewer`, which looks around from
 * one fixed point *inside* a room. See `SPINNER_SPEC.md` for the decisions.
 *
 * Frames are drawn to a single canvas rather than mounted as elements: a
 * 160-frame orbit would otherwise leave 160 full-size images in the DOM once
 * the guest has been all the way round.
 *
 * Loading goes in batches around the current frame, then fills in the rest in
 * the background, so arriving costs one frame rather than the whole sequence.
 *
 * The arrows and arrow keys jump to the next `keyAngles` stop and animate the
 * frames in between — stepping 160 frames one at a time is unusable. A press
 * during an animation queues the next stop instead of being dropped.
 *
 * A hotspot only exists across the sub-range of frames where it actually faces
 * the camera: `hotspotPosition()` walks its `keyframes` in the order given —
 * the sweep from where it comes into view to where it leaves — and interpolates
 * between whichever two bracket the current frame.
 */

export interface SpinnerRoomFacts {
  name: string;
  areaM2: number;
  floor: number;
  capacity: number;
  bedType: 'king' | 'queen' | 'twin';
  nightlyPrice: number;
  currency: Currency;
  status?: RoomStatus;
  remaining?: number;
  photo?: { url: string; width?: number; height?: number };
}

interface BuildingSpinnerProps {
  spinner: BuildingSpinnerData;
  /** Today's flat photo — shown, unchanged, if the frame sequence fails to load. */
  fallbackPhoto: { url: string; width: number; height: number; alt: string };
  title: string;
  rooms?: Record<string, SpinnerRoomFacts>;
  /** Only the visible layer captures drag/keyboard — a hidden cross-fade layer must not. */
  active: boolean;
  initialFrame?: number;
  focusHotspotId?: string | null;
  className?: string;
}

/** Roughly a full turn per 700px of drag, whatever the frame count. */
const DRAG_PX_PER_TURN = 700;
/** A mouse needs a deliberate push before the building moves; a finger is allowed to be twitchier. */
const DRAG_THRESHOLD_MOUSE_PX = 50;
const DRAG_THRESHOLD_TOUCH_PX = 8;
/** Stops queued while an animation is already running; beyond this, presses are dropped. */
const KEYFRAME_QUEUE_MAX = 10;
/** A jump between stops scales with distance, so a short hop still feels snappy. */
const KEYFRAME_MS_PER_FRAME = 18;
const KEYFRAME_MIN_DURATION_MS = 260;
const KEYFRAME_MAX_DURATION_MS = 620;
/** Frames beyond the target the swing can overshoot into before settling back. */
const KEYFRAME_OVERSHOOT_FRAMES = 3;
const PRELOAD_BATCH_DESKTOP = 12;
const PRELOAD_BATCH_MOBILE = 8;
const BACKGROUND_BATCH_DELAY_MS = 120;
const FRAME_LOAD_RETRY_DELAY_MS = 1000;

function wrap(index: number, count: number): number {
  return ((index % count) + count) % count;
}

/** Shortest signed distance from `from` to `to` around a ring of `count`. */
function ringDelta(from: number, to: number, count: number): number {
  const forward = wrap(to - from, count);
  return forward <= count - forward ? forward : forward - count;
}

/** Where `object-fit: cover` puts the frame inside the stage. */
function coverRect(frame: { width: number; height: number }, dims: { width: number; height: number }) {
  const scale = Math.max(dims.width / frame.width, dims.height / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  return { x: (dims.width - width) / 2, y: (dims.height - height) / 2, width, height };
}

/**
 * Where a hotspot sits at `frameIndex`, or `null` outside its visible arc.
 * The arc runs forward (wrapping) from its first keyframe to its last —
 * authored in that sweep order, not necessarily ascending frame numbers.
 */
function hotspotPosition(
  hotspot: SpinnerHotspot,
  frameIndex: number,
  frameCount: number,
): { x: number; y: number } | null {
  const first = hotspot.keyframes[0]!.frameIndex;
  const last = hotspot.keyframes[hotspot.keyframes.length - 1]!.frameIndex;
  const total = wrap(last - first, frameCount);
  const pos = wrap(frameIndex - first, frameCount);
  if (pos > total) return null;

  const withPos = hotspot.keyframes
    .map((keyframe) => ({ ...keyframe, pos: wrap(keyframe.frameIndex - first, frameCount) }))
    .sort((a, b) => a.pos - b.pos);

  let lower = withPos[0]!;
  let upper = withPos[withPos.length - 1]!;
  for (let i = 0; i < withPos.length - 1; i++) {
    if (pos >= withPos[i]!.pos && pos <= withPos[i + 1]!.pos) {
      lower = withPos[i]!;
      upper = withPos[i + 1]!;
      break;
    }
  }
  const span = upper.pos - lower.pos;
  const t = span === 0 ? 0 : (pos - lower.pos) / span;
  return { x: lower.x + (upper.x - lower.x) * t, y: lower.y + (upper.y - lower.y) * t };
}

/**
 * The traced footprint at `frameIndex`, or `null` where the hotspot carries no
 * outline. Corners are interpolated between the two keyframes bracketing the
 * frame, so the shape turns with the building instead of jumping at each stop.
 */
function hotspotOutline(
  hotspot: SpinnerHotspot,
  frameIndex: number,
  frameCount: number,
): { x: number; y: number }[] | null {
  const first = hotspot.keyframes[0]!.frameIndex;
  const last = hotspot.keyframes[hotspot.keyframes.length - 1]!.frameIndex;
  const total = wrap(last - first, frameCount);
  const pos = wrap(frameIndex - first, frameCount);
  if (pos > total) return null;

  const withPos = hotspot.keyframes
    .map((keyframe) => ({ ...keyframe, pos: wrap(keyframe.frameIndex - first, frameCount) }))
    .sort((a, b) => a.pos - b.pos)
    .filter((keyframe) => keyframe.outline && keyframe.outline.length >= 3);
  if (withPos.length === 0) return null;

  let lower = withPos[0]!;
  let upper = withPos[withPos.length - 1]!;
  for (let i = 0; i < withPos.length - 1; i++) {
    if (pos >= withPos[i]!.pos && pos <= withPos[i + 1]!.pos) {
      lower = withPos[i]!;
      upper = withPos[i + 1]!;
      break;
    }
  }
  // Outside the traced span the nearest traced shape is the honest answer.
  if (pos < lower.pos || pos > upper.pos) {
    const nearest = pos < lower.pos ? lower : upper;
    return nearest.outline!;
  }
  const span = upper.pos - lower.pos;
  const t = span === 0 ? 0 : (pos - lower.pos) / span;
  const count = Math.min(lower.outline!.length, upper.outline!.length);
  return Array.from({ length: count }, (_, i) => ({
    x: lower.outline![i]!.x + (upper.outline![i]!.x - lower.outline![i]!.x) * t,
    y: lower.outline![i]!.y + (upper.outline![i]!.y - lower.outline![i]!.y) * t,
  }));
}

/**
 * Standard "back" easing (easings.net): overshoots past 1 then eases back to
 * exactly 1 — a jump between stops swings a couple of frames past the target
 * and settles, like the real thing has weight instead of stopping dead.
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

/** A frame roughly in the middle of a hotspot's visible arc — for a deep link with no explicit frame. */
function midArcFrame(hotspot: SpinnerHotspot, frameCount: number): number {
  const first = hotspot.keyframes[0]!.frameIndex;
  const last = hotspot.keyframes[hotspot.keyframes.length - 1]!.frameIndex;
  const total = wrap(last - first, frameCount);
  return wrap(first + Math.round(total / 2), frameCount);
}

export function BuildingSpinner({
  spinner,
  fallbackPhoto,
  title,
  rooms,
  active,
  initialFrame,
  focusHotspotId,
  className,
}: BuildingSpinnerProps) {
  const frameCount = spinner.frameCount;
  const frameSize = { width: spinner.frameWidth, height: spinner.frameHeight };
  const keyAngles = React.useMemo(
    () => [...spinner.keyAngles].sort((a, b) => a - b),
    [spinner.keyAngles],
  );

  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = React.useState({ width: 0, height: 0 });
  const [hasError, setHasError] = React.useState(false);
  const [isSpinning, setIsSpinning] = React.useState(false);
  const [activeHotspot, setActiveHotspot] = React.useState<string | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = React.useState<string | null>(null);
  const markerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeAnchor, setActiveAnchor] = React.useState<CardAnchor | null>(null);

  const [frameIndex, setFrameIndex] = React.useState(() => {
    if (typeof initialFrame === 'number') return wrap(initialFrame, frameCount);
    if (focusHotspotId) {
      const hotspot = spinner.hotspots.find((candidate) => candidate.id === focusHotspotId);
      if (hotspot) return midArcFrame(hotspot, frameCount);
    }
    return 0;
  });
  const frameIndexRef = React.useRef(frameIndex);
  frameIndexRef.current = frameIndex;
  const initialIndexRef = React.useRef(frameIndex);

  // ---- frame images -------------------------------------------------------

  const imagesRef = React.useRef<(HTMLImageElement | null)[]>([]);
  const [readyTick, setReadyTick] = React.useState(0);
  const readyRef = React.useRef<Set<number>>(new Set());

  const loadFrame = React.useCallback(
    (index: number, retried = false) => {
      if (imagesRef.current[index]) return;
      const frame = spinner.frames[index];
      if (!frame) return;
      const image = new Image();
      imagesRef.current[index] = image;
      image.decoding = 'async';
      image.onload = () => {
        readyRef.current.add(index);
        setReadyTick((tick) => tick + 1);
      };
      image.onerror = () => {
        imagesRef.current[index] = null;
        if (!retried) {
          window.setTimeout(() => loadFrame(index, true), FRAME_LOAD_RETRY_DELAY_MS);
        } else if (index === initialIndexRef.current) {
          setHasError(true);
        }
      };
      image.src = frame.imageUrl;
    },
    [spinner.frames],
  );

  React.useEffect(() => {
    const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    const batch = touch ? PRELOAD_BATCH_MOBILE : PRELOAD_BATCH_DESKTOP;
    // The arrival frame first, then its neighbours, then the rest of the ring in
    // the background so a later spin never waits on the network.
    loadFrame(initialIndexRef.current);
    for (let offset = 1; offset <= batch; offset++) {
      loadFrame(wrap(initialIndexRef.current + offset, frameCount));
      loadFrame(wrap(initialIndexRef.current - offset, frameCount));
    }
    let offset = batch + 1;
    const timer = window.setInterval(() => {
      for (let i = 0; i < batch && offset <= frameCount; i++, offset++) {
        loadFrame(wrap(initialIndexRef.current + offset, frameCount));
        loadFrame(wrap(initialIndexRef.current - offset, frameCount));
      }
      if (offset > frameCount) window.clearInterval(timer);
    }, BACKGROUND_BATCH_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [loadFrame, frameCount]);

  // ---- canvas -------------------------------------------------------------

  React.useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.width === 0 || dims.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(dims.width * dpr);
    canvas.height = Math.round(dims.height * dpr);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Nothing decoded here yet: hold the last drawn frame rather than flashing empty.
    const image = imagesRef.current[frameIndex];
    if (!image || !readyRef.current.has(frameIndex)) return;
    const rect = coverRect(frameSize, dims);
    context.clearRect(0, 0, dims.width, dims.height);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }, [frameIndex, dims, readyTick, frameSize.width, frameSize.height]);

  // ---- keyframe navigation ------------------------------------------------

  const queueRef = React.useRef<number[]>([]);
  const animationRef = React.useRef<number | null>(null);
  /**
   * Where the presses so far will finish. A second press has to step on from
   * there, not from the frame currently on screen, or it lands on the stop the
   * spinner is already travelling to and the press is lost.
   */
  const intendedRef = React.useRef(frameIndex);

  const stopAnimation = React.useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const runQueue = React.useCallback(() => {
    if (animationRef.current !== null) return;
    const target = queueRef.current.shift();
    if (target === undefined) {
      setIsSpinning(false);
      return;
    }
    const delta = ringDelta(frameIndexRef.current, target, frameCount);
    if (delta === 0) {
      runQueue();
      return;
    }
    const start = frameIndexRef.current;
    const duration = Math.min(
      KEYFRAME_MAX_DURATION_MS,
      Math.max(KEYFRAME_MIN_DURATION_MS, Math.abs(delta) * KEYFRAME_MS_PER_FRAME),
    );
    // The swing can pass a few frames beyond the target before settling back —
    // preload those too, in case a deep link landed here before the background
    // loader reached them.
    const overshootFrames = Math.min(Math.abs(delta), KEYFRAME_OVERSHOOT_FRAMES);
    for (let step = 1; step <= overshootFrames; step++) {
      loadFrame(wrap(target + Math.sign(delta) * step, frameCount));
    }
    setIsSpinning(true);
    setActiveHotspot(null);
    const startTime = performance.now();
    let drawn = start;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutBack(t);
      const position = wrap(Math.round(start + delta * eased), frameCount);
      if (position !== drawn) {
        drawn = position;
        frameIndexRef.current = position;
        setFrameIndex(position);
      }
      if (t < 1) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        animationRef.current = null;
        frameIndexRef.current = target;
        setFrameIndex(target);
        runQueue();
      }
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [frameCount, loadFrame]);

  const goToKeyAngle = React.useCallback(
    (direction: 1 | -1) => {
      if (keyAngles.length === 0) return;
      if (queueRef.current.length >= KEYFRAME_QUEUE_MAX) return;
      const from = intendedRef.current;
      // The next stop the given way round, never the one we are already sitting on.
      let best: number | null = null;
      let bestDistance = Infinity;
      for (const angle of keyAngles) {
        const forward = direction === 1 ? wrap(angle - from, frameCount) : wrap(from - angle, frameCount);
        if (forward === 0) continue;
        if (forward < bestDistance) {
          bestDistance = forward;
          best = angle;
        }
      }
      if (best === null) return;
      intendedRef.current = best;
      queueRef.current.push(best);
      runQueue();
    },
    [keyAngles, frameCount, runQueue],
  );

  React.useEffect(() => () => stopAnimation(), [stopAnimation]);

  // ---- url ----------------------------------------------------------------

  const urlSyncRef = React.useRef(false);
  React.useEffect(() => {
    if (!active || urlSyncRef.current) return;
    urlSyncRef.current = true;
    requestAnimationFrame(() => {
      urlSyncRef.current = false;
      const params = new URLSearchParams(window.location.search);
      params.set('frame', String(frameIndexRef.current));
      const search = params.toString();
      try {
        window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
      } catch {
        // Sandboxed embeds refuse history writes; the spinner works without the deep link.
      }
    });
  }, [frameIndex, active]);

  // ---- hotspots -----------------------------------------------------------

  const { cardRef: activeCardRef, style: activeCardStyle } = useAnchoredCard(activeAnchor, dims);

  const visible = React.useMemo(
    () =>
      spinner.hotspots
        .map((hotspot) => ({
          hotspot,
          position: hotspotPosition(hotspot, frameIndex, frameCount),
          outline: hotspotOutline(hotspot, frameIndex, frameCount),
        }))
        .filter(
          (entry): entry is { hotspot: SpinnerHotspot; position: { x: number; y: number }; outline: { x: number; y: number }[] | null } =>
            entry.position !== null,
        ),
    [spinner.hotspots, frameIndex, frameCount],
  );

  React.useEffect(() => {
    if (activeHotspot && !visible.some((entry) => entry.hotspot.id === activeHotspot)) {
      setActiveHotspot(null);
    }
  }, [visible, activeHotspot]);

  /** Hover previews the card; a click pins it, so it survives the pointer leaving. */
  const shownHotspot = activeHotspot ?? hoveredHotspot;

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    const marker = shownHotspot ? markerRefs.current[shownHotspot] : null;
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
  }, [shownHotspot, dims.width, dims.height, frameIndex]);

  const active_ = visible.find((entry) => entry.hotspot.id === shownHotspot) ?? null;

  // ---- drag ---------------------------------------------------------------

  const dragRef = React.useRef<{ startX: number; startFrame: number; moved: boolean; pointerId: number; threshold: number } | null>(null);
  /** Whether the press that just ended travelled — read by the markers' click handler. */
  const draggedRef = React.useRef(false);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!active || hasError) return;
    stopAnimation();
    queueRef.current = [];
    intendedRef.current = frameIndexRef.current;
    // Capture is taken only once the drag moves: capturing on press retargets the
    // following `click` to this element, so a marker tap would never reach the marker.
    dragRef.current = {
      startX: event.clientX,
      startFrame: frameIndexRef.current,
      moved: false,
      pointerId: event.pointerId,
      threshold: event.pointerType === 'mouse' ? DRAG_THRESHOLD_MOUSE_PX : DRAG_THRESHOLD_TOUCH_PX,
    };
    draggedRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(deltaX) < drag.threshold) return;
    if (!drag.moved) {
      setIsSpinning(true);
      event.currentTarget.setPointerCapture(drag.pointerId);
    }
    drag.moved = true;
    draggedRef.current = true;
    if (activeHotspot) setActiveHotspot(null);
    const steps = Math.round((deltaX / DRAG_PX_PER_TURN) * frameCount);
    const next = wrap(drag.startFrame + steps, frameCount);
    frameIndexRef.current = next;
    intendedRef.current = next;
    setFrameIndex(next);
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsSpinning(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!active) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToKeyAngle(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToKeyAngle(1);
    }
  };

  // ---- render -------------------------------------------------------------

  const rect = dims.width > 0 ? coverRect(frameSize, dims) : null;
  const positionFor = (point: { x: number; y: number }): React.CSSProperties => {
    if (!rect) return { left: `${point.x * 100}%`, top: `${point.y * 100}%` };
    return { left: rect.x + point.x * rect.width, top: rect.y + point.y * rect.height };
  };

  const marker = (
    hotspot: SpinnerHotspot,
    point: { x: number; y: number },
    isActive: boolean,
    isHovered: boolean,
  ) => {
    const line = formatRoomLine(hotspot.roomSlug ? rooms?.[hotspot.roomSlug] : undefined);
    return (
      <button
        key={hotspot.id}
        ref={(element) => {
          markerRefs.current[hotspot.id] = element;
        }}
        type="button"
        aria-pressed={isActive}
        aria-label={[hotspot.label, line].filter(Boolean).join(', ')}
        onClick={(event) => {
          event.stopPropagation();
          // A marker must not block the spin: a press that travelled was a drag.
          if (draggedRef.current) return;
          setActiveHotspot(isActive ? null : hotspot.id);
        }}
        onMouseEnter={() => setHoveredHotspot(hotspot.id)}
        onMouseLeave={() => setHoveredHotspot(null)}
        style={positionFor(point)}
        className={cn(
          'absolute z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-2.5 rounded-full p-1 pr-1 text-sm font-medium transition-colors sm:pr-4',
          isActive || isHovered ? 'bg-ink text-[#F7F5F0]' : 'glass text-foreground hover:bg-white/90',
        )}
      >
        <span
          aria-hidden="true"
          className={cn('grid size-9 place-items-center rounded-full', isActive ? 'bg-white/15 text-white' : 'bg-ink text-[#F7F5F0]')}
        >
          <MapPin weight="fill" className="size-4" />
        </span>
        <span className="hidden sm:inline">
          {hotspot.label}
          {line ? <span className={cn('font-normal', isActive ? 'text-white/70' : 'text-muted-foreground')}> · {line}</span> : null}
        </span>
      </button>
    );
  };

  const cardFacts = active_?.hotspot.roomSlug ? rooms?.[active_.hotspot.roomSlug] : undefined;
  const card = active_ ? (
    <Link
      ref={activeCardRef as React.Ref<HTMLAnchorElement>}
      href={active_.hotspot.href}
      aria-live="polite"
      style={activeCardStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseEnter={() => setHoveredHotspot(active_.hotspot.id)}
      onMouseLeave={() => setHoveredHotspot(null)}
      className="glass absolute z-30 block w-[min(20rem,calc(100%-2rem))] overflow-hidden rounded-3xl text-foreground shadow-soft-lg"
    >
      {cardFacts?.photo ? (
        <img
          src={cardFacts.photo.url}
          alt=""
          width={640}
          height={360}
          decoding="async"
          className="h-36 w-full object-cover"
        />
      ) : null}
      <div className="p-4">
        {cardFacts?.status ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              cardFacts.status === 'sold_out' ? 'bg-stone text-muted-foreground' : 'bg-[#E8F3EC] text-[#1F6B41]',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-1.5 rounded-full', cardFacts.status === 'sold_out' ? 'bg-muted-foreground' : 'bg-[#2F9E63]')}
            />
            {statusText(cardFacts.status, cardFacts.remaining ?? 0)}
          </span>
        ) : null}
        <p className="mt-2 font-medium">
          {cardFacts ? `${cardFacts.name} — ${formatMoney(cardFacts.nightlyPrice, cardFacts.currency)}` : active_.hotspot.label}
          {cardFacts ? <span className="text-sm font-normal text-muted-foreground"> a night</span> : null}
        </p>
        {cardFacts ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Ruler weight="fill" className="size-4" aria-hidden="true" />
              {cardFacts.areaM2} m²
            </li>
            <li className="flex items-center gap-2">
              <Bed weight="fill" className="size-4" aria-hidden="true" />
              {bedLabels[cardFacts.bedType]}
            </li>
            <li className="flex items-center gap-2">
              <UsersIcon className="size-4" aria-hidden="true" />
              Sleeps {cardFacts.capacity}
            </li>
          </ul>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{active_.hotspot.description}</p>
        )}
        <span className={pill('primary', 'mt-3 h-10 w-full px-4')}>
          {active_.hotspot.cta}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  ) : null;

  // Frame sequence unusable: the exact photo StaySphere shows today, with the
  // same markers pinned at their front-on position — no drag, no error banner.
  if (hasError) {
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
        {spinner.hotspots.map((hotspot) => {
          const point = hotspot.keyframes.find((keyframe) => keyframe.frameIndex === 0) ?? hotspot.keyframes[0]!;
          return marker(hotspot, point, hotspot.id === activeHotspot, hoveredHotspot === hotspot.id);
        })}
        {card}
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      role="group"
      tabIndex={active ? 0 : -1}
      aria-roledescription="carousel"
      aria-label={`${title}, drag or use the arrow keys to spin around the building`}
      className={cn('relative size-full touch-none outline-none select-none', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} aria-label={title} className="pointer-events-none absolute inset-0 size-full" />

      {/* The part of the building a marker stands for, traced on the frame and
          lit on hover — the way a plan lets you point at a wing. The shapes take
          no pointer events: a drag that starts on one must still turn the view,
          so hover and click are found by hit-testing in the handlers above. */}
      {!isSpinning && rect ? (
        <svg className="pointer-events-none absolute inset-0 z-[5] size-full" aria-hidden="true">
          {visible.map(({ hotspot, outline }) => {
            if (!outline) return null;
            const lit = hoveredHotspot === hotspot.id || activeHotspot === hotspot.id;
            // Sold stock reads red, everything on sale reads in the product's clay
            // accent — the zone is legible as inventory before it is hovered.
            const soldOut = hotspot.roomSlug ? rooms?.[hotspot.roomSlug]?.status === 'sold_out' : false;
            return (
              <polygon
                key={hotspot.id}
                points={outline
                  .map((point) => `${rect.x + point.x * rect.width},${rect.y + point.y * rect.height}`)
                  .join(' ')}
                strokeWidth={lit ? 3 : 2}
                strokeLinejoin="round"
                className={cn(
                  'pointer-events-auto cursor-pointer transition-[fill,stroke,stroke-width] duration-200',
                  '[filter:drop-shadow(0_1px_3px_rgb(22_22_22/0.55))]',
                  soldOut ? 'stroke-[#E5484D]' : 'stroke-accent',
                  lit ? (soldOut ? 'fill-[#E5484D]/45' : 'fill-accent/40') : 'fill-white/[0.06]',
                )}
                onMouseEnter={() => setHoveredHotspot(hotspot.id)}
                onMouseLeave={() => setHoveredHotspot(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (draggedRef.current) return;
                  setActiveHotspot((current) => (current === hotspot.id ? null : hotspot.id));
                }}
              />
            );
          })}
        </svg>
      ) : null}

      {!isSpinning
        ? visible.map(({ hotspot, position }) =>
            marker(hotspot, position, hotspot.id === activeHotspot, hoveredHotspot === hotspot.id),
          )
        : null}

      {card}

      {/* Turn the building an eighth at a time — distinct from HotelScene's
          area-to-area paging arrows, which move between facade/pool/spa/lobby. */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/85 p-1 pr-1 backdrop-blur-sm">
        <button
          type="button"
          aria-label="Turn left"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => goToKeyAngle(-1)}
          className={cn(iconButton('dark'), 'pointer-events-auto size-10 bg-transparent hover:bg-white/15')}
        >
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
        </button>
        <span className="px-1 text-sm font-medium text-[#F7F5F0]">360°</span>
        <button
          type="button"
          aria-label="Turn right"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => goToKeyAngle(1)}
          className={cn(iconButton('dark'), 'pointer-events-auto size-10 bg-transparent hover:bg-white/15')}
        >
          <ChevronRightIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
