'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Bed, MapPin, Ruler } from '@phosphor-icons/react/dist/ssr';
import { useAnchoredCard, type CardAnchor } from '@/components/hotel/use-anchored-card';
import { factTone, tintInk, tintSurface } from '@/components/rooms/feature-icon';
import { Modal } from '@/components/site/modal';
import type { BuildingSpinnerData, Currency, RoomStatus, SpinnerHotspot } from '@/lib/domain/schemas';
import { bedLabels, formatMoney, formatRoomLine, statusText } from '@/lib/formatting';
import { iconButton, pill, tag } from '@/lib/ui';
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
  /** The guest's dates, carried into whatever a hotspot links to. */
  stayQuery?: string;
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
/**
 * Frames a second while travelling between stops. Capped at a 60Hz screen's own
 * rate: the old 15ms interval asked for ~67, and the frames the display could
 * not present were dropped unevenly, which is what read as judder.
 */
const STEP_FPS = 60;
/** Stops queued while an animation is already running; beyond this, presses are dropped. */
const KEYFRAME_QUEUE_MAX = 10;
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
/**
 * A hotspot's keyframes, prepared once. Sorting and filtering them per frame —
 * for every hotspot, twice, on every step of a drag — was throwing away a few
 * hundred objects a frame and showed up as a stutter as soon as the facade had
 * a marker for each of its storeys. Keyframes never change, so this is done
 * when the spinner mounts and only the interpolation is left per frame.
 */
interface HotspotTrack {
  /** Frame the arc opens on, and how many frames it runs for. */
  first: number;
  total: number;
  positions: { pos: number; x: number; y: number }[];
}

function buildTrack(hotspot: SpinnerHotspot, frameCount: number): HotspotTrack {
  const first = hotspot.keyframes[0]!.frameIndex;
  const last = hotspot.keyframes[hotspot.keyframes.length - 1]!.frameIndex;
  const withPos = hotspot.keyframes
    .map((keyframe) => ({ keyframe, pos: wrap(keyframe.frameIndex - first, frameCount) }))
    .sort((a, b) => a.pos - b.pos);
  return {
    first,
    total: wrap(last - first, frameCount),
    positions: withPos.map(({ keyframe, pos }) => ({ pos, x: keyframe.x, y: keyframe.y })),
  };
}

/** The two prepared keyframes bracketing `pos`, and how far between them it sits. */
function bracket<T extends { pos: number }>(entries: T[], pos: number): { lower: T; upper: T; t: number } {
  let lower = entries[0]!;
  let upper = entries[entries.length - 1]!;
  for (let i = 0; i < entries.length - 1; i += 1) {
    if (pos >= entries[i]!.pos && pos <= entries[i + 1]!.pos) {
      lower = entries[i]!;
      upper = entries[i + 1]!;
      break;
    }
  }
  const span = upper.pos - lower.pos;
  return { lower, upper, t: span === 0 ? 0 : (pos - lower.pos) / span };
}

function hotspotPosition(
  track: HotspotTrack,
  frameIndex: number,
  frameCount: number,
): { x: number; y: number } | null {
  const pos = wrap(frameIndex - track.first, frameCount);
  if (pos > track.total) return null;
  const { lower, upper, t } = bracket(track.positions, pos);
  return { x: lower.x + (upper.x - lower.x) * t, y: lower.y + (upper.y - lower.y) * t };
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
  stayQuery,
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
  // Below `sm` a storey opens the product's own sheet instead of a card
  // floating on the stage — the same swap `HotelScene` makes for its markers.
  const [isPhone, setIsPhone] = React.useState(false);
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
    // Frame 0 isn't necessarily a face of the building — land on whichever
    // stop the property listed first instead of an arbitrary capture angle.
    return keyAngles[0] ?? 0;
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

  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const apply = () => setIsPhone(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

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
    const direction = delta > 0 ? 1 : -1;
    const total = Math.abs(delta);
    const from = frameIndexRef.current;
    const startedAt = performance.now();
    let stepped = 0;
    setIsSpinning(true);
    setActiveHotspot(null);
    const tick = (now: number) => {
      // Where the clock says the turn should be, not one frame per tick: the
      // journey then takes the same time on a 120Hz screen as on a 60Hz one.
      // Never more than a frame at a time, so a late tick holds the turn where
      // it is rather than jumping a gap across the facade.
      const due = Math.floor(((now - startedAt) / 1000) * STEP_FPS);
      stepped = Math.min(total, Math.max(stepped, Math.min(due, stepped + 1)));
      const next = wrap(from + direction * stepped, frameCount);
      if (next !== frameIndexRef.current) {
        frameIndexRef.current = next;
        setFrameIndex(next);
      }
      if (stepped >= total) {
        animationRef.current = null;
        runQueue();
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [frameCount]);

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

  // Prepared once for the whole orbit; only the interpolation runs per frame.
  const tracks = React.useMemo(
    () => spinner.hotspots.map((hotspot) => ({ hotspot, track: buildTrack(hotspot, frameCount) })),
    [spinner.hotspots, frameCount],
  );

  const visible = React.useMemo(
    () =>
      tracks
        .map(({ hotspot, track }) => ({ hotspot, position: hotspotPosition(track, frameIndex, frameCount) }))
        .filter(
          (entry): entry is { hotspot: SpinnerHotspot; position: { x: number; y: number } } => entry.position !== null,
        ),
    [tracks, frameIndex, frameCount],
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
          'absolute z-10 flex min-h-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-2 rounded-full p-1 pr-1 text-xs font-medium transition-colors sm:pr-3',
          isActive || isHovered ? 'bg-ink text-[#F7F5F0]' : 'glass text-foreground hover:bg-white/90',
        )}
      >
        <span
          aria-hidden="true"
          className={cn('grid size-7 place-items-center rounded-full', isActive ? 'bg-white/15 text-white' : 'bg-ink text-[#F7F5F0]')}
        >
          <MapPin weight="fill" className="size-3.5" />
        </span>
        <span className="hidden sm:inline">
          {hotspot.label}
          {line ? <span className={cn('font-normal', isActive ? 'text-white/70' : 'text-muted-foreground')}> · {line}</span> : null}
        </span>
      </button>
    );
  };

  const cardFacts = active_?.hotspot.roomSlug ? rooms?.[active_.hotspot.roomSlug] : undefined;
  // The stay the guest already chose survives the jump into the catalog, the
  // same way it does from every other link on the arrival screen.
  const cardHref = (): string => {
    const [path, query] = active_!.hotspot.href.split('?');
    const params = new URLSearchParams(query ?? '');
    if (stayQuery) new URLSearchParams(stayQuery).forEach((value, key) => params.set(key, value));
    const search = params.toString();
    return search ? `${path}?${search}` : path!;
  };
  const card = active_ && !isPhone ? (
    <Link
      ref={activeCardRef as React.Ref<HTMLAnchorElement>}
      href={cardHref()}
      aria-live="polite"
      style={activeCardStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseEnter={() => setHoveredHotspot(active_.hotspot.id)}
      // No leave handler: the card opens under the pointer that summoned it, and
      // the browser answers that by sending it a leave the instant it mounts —
      // which shut the topmost storey's card again before it could be read. The
      // stage resolves the hover on every move anyway, and clears it on the way
      // out, so there is nothing here left to close.
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

      {!isSpinning
        ? visible.map(({ hotspot, position }) =>
            marker(hotspot, position, hotspot.id === activeHotspot, hoveredHotspot === hotspot.id),
          )
        : null}

      {card}

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/85 p-1 backdrop-blur-sm">
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

      {/* The phone's version of the storey card: the product's own sheet, the
          same one every other tap opens. There is no room for a card floating
          beside a storey when the stage is the whole screen, and a sheet has
          room for the prose the card had to drop. */}
      <Modal
        open={Boolean(activeHotspot) && isPhone}
        onClose={() => setActiveHotspot(null)}
        title={cardFacts?.name ?? active_?.hotspot.label ?? ''}
      >
        {active_ ? (
          <div className="flex flex-col">
            {cardFacts?.photo ? (
              <img
                src={cardFacts.photo.url}
                alt=""
                width={cardFacts.photo.width}
                height={cardFacts.photo.height}
                className="aspect-[3/2] w-full rounded-[20px] object-cover"
              />
            ) : null}

            {cardFacts?.status ? (
              <span
                className={cn(
                  'mt-5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                  cardFacts.status === 'sold_out' ? 'bg-stone text-muted-foreground' : 'bg-[#E8F3EC] text-[#1F6B41]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    cardFacts.status === 'sold_out' ? 'bg-muted-foreground' : 'bg-[#2F9E63]',
                  )}
                />
                {statusText(cardFacts.status, cardFacts.remaining ?? 0)}
              </span>
            ) : null}

            {/* No heading here: the sheet's own bar already names the room,
                and saying it twice reads as a mistake. The price is what the
                guest came to this sheet for, so it takes the display size. */}
            {cardFacts ? (
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-display text-3xl">
                  {formatMoney(cardFacts.nightlyPrice, cardFacts.currency)}
                </span>
                <span className="text-sm text-muted-foreground">a night</span>
              </p>
            ) : null}

            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              {active_.hotspot.description}
            </p>

            {cardFacts ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                <li className={tag(tintSurface[factTone.area])}>
                  <Ruler weight="fill" className={cn('size-3.5', tintInk[factTone.area])} aria-hidden="true" />
                  {cardFacts.areaM2} m²
                </li>
                <li className={tag(tintSurface[factTone.bed])}>
                  <Bed weight="fill" className={cn('size-3.5', tintInk[factTone.bed])} aria-hidden="true" />
                  {bedLabels[cardFacts.bedType]}
                </li>
                <li className={tag(tintSurface[factTone.capacity])}>
                  <UsersIcon className={cn('size-3.5', tintInk[factTone.capacity])} aria-hidden="true" />
                  Sleeps {cardFacts.capacity}
                </li>
              </ul>
            ) : null}

            <Link href={cardHref()} className={pill('primary', 'mt-6 min-h-12 w-full justify-center')}>
              {active_.hotspot.cta}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
