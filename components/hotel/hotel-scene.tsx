'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Orbit,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResortMassing } from './resort-massing';

/**
 * Three.js is loaded only when a visitor asks for it. The SVG poster above is a
 * complete, interactive arrival screen on its own, so the catalog is never
 * waiting on a 3D bundle.
 */
const ResortCanvas = React.lazy(() => import('./resort-canvas'));

/**
 * WebGL can be unavailable or blocked (old hardware, a locked-down browser, a
 * lost context). The arrival screen must survive that, so a failure inside the
 * canvas drops the visitor back to the poster instead of blanking the route.
 */
class SceneBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D scene failed; falling back to the poster', error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 700;
/** Pointer travel before a press becomes a camera drag rather than a click. */
const DRAG_THRESHOLD_PX = 6;

interface Hotspot {
  id: string;
  label: string;
  description: string;
  href: string;
  cta: string;
  /** Position in SVG coordinates, plus the parallax layer it belongs to. */
  x: number;
  y: number;
  depth: number;
  /** The same anchor in the 3D scene. */
  position: [number, number, number];
}

const hotspots: Hotspot[] = [
  {
    id: 'sea-view',
    label: 'Sea view',
    description:
      'Floors three and up face the open cove. Every sea-view room has a full-width balcony and a west-facing sunset.',
    href: '/rooms?view=sea',
    cta: 'See sea-view rooms',
    x: 620,
    y: 232,
    depth: 0.32,
    position: [3.6, 9.5, 3.2],
  },
  {
    id: 'pool',
    label: 'Pool',
    description:
      'A 25-metre saltwater pool on the lower terrace, shaded from midday, with direct-access rooms along the quiet end.',
    href: '/rooms?view=pool',
    cta: 'See pool-access rooms',
    x: 300,
    y: 560,
    depth: 0.52,
    position: [-8.5, 1.2, 7],
  },
  {
    id: 'spa',
    label: 'Spa',
    description:
      'The cliffside spa annex: two treatment rooms, a hammam, and a cold plunge cut into the rock.',
    href: '/rooms?addOn=addon_spa',
    cta: 'Add a spa ritual',
    x: 850,
    y: 462,
    depth: 0.32,
    position: [7.5, 3, 2],
  },
  {
    id: 'lobby',
    label: 'Lobby',
    description:
      'Arrival is at the glazed base of the tower — reception, the library bar, and the path down to the beach club.',
    href: '/rooms',
    cta: 'Browse every room',
    x: 600,
    y: 492,
    depth: 0.32,
    position: [0, 1.4, 3.4],
  },
];

interface HotelSceneProps {
  className?: string;
  /** Query string appended to hotspot links so the stay survives navigation. */
  stayQuery?: string;
}

export function HotelScene({ className, stayQuery }: HotelSceneProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [orbit, setOrbit] = React.useState(0);
  const [dims, setDims] = React.useState({ width: 0, height: 0 });
  const [activeHotspot, setActiveHotspot] = React.useState<string | null>(null);
  const [autoRotate, setAutoRotate] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [mode, setMode] = React.useState<'poster' | 'three'>('poster');
  const [threeFailed, setThreeFailed] = React.useState(false);
  const dragState = React.useRef<{
    pointerId: number;
    startX: number;
    startOrbit: number;
    captured: boolean;
  } | null>(null);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  React.useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setDims({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  React.useEffect(() => {
    if (!autoRotate || reducedMotion) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setOrbit(Math.sin((now - start) / 3200) * 0.85);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, reducedMotion]);

  const nudge = (delta: number) => {
    setAutoRotate(false);
    setOrbit((current) => clamp(current + delta));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'poster' || event.button !== 0) return;
    // Hotspots and controls live inside the stage; never steal their clicks.
    if ((event.target as HTMLElement).closest('button, a')) return;
    setAutoRotate(false);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOrbit: orbit,
      captured: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const travelled = Math.abs(event.clientX - drag.startX);
    // Capture only once this is unmistakably a drag: capturing on pointerdown
    // retargets the pointerup and suppresses the click on child controls.
    if (!drag.captured) {
      if (travelled < DRAG_THRESHOLD_PX) return;
      drag.captured = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const width = dims.width || event.currentTarget.clientWidth || 1;
    setOrbit(clamp(drag.startOrbit - ((event.clientX - drag.startX) / width) * 2.4));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nudge(-0.2);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nudge(0.2);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setAutoRotate(false);
      setOrbit(0);
    }
  };

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

  /**
   * `preserveAspectRatio="slice"` crops the scene, so hotspot positions have to
   * be mapped through the same transform to stay glued to the building.
   */
  const positionFor = (hotspot: Hotspot): React.CSSProperties => {
    const shift = -orbit * hotspot.depth * 90;
    if (!dims.width || !dims.height) {
      return {
        left: `${((hotspot.x + shift) / VIEWBOX_WIDTH) * 100}%`,
        top: `${(hotspot.y / VIEWBOX_HEIGHT) * 100}%`,
      };
    }
    const scale = Math.max(dims.width / VIEWBOX_WIDTH, dims.height / VIEWBOX_HEIGHT);
    return {
      left: (dims.width - VIEWBOX_WIDTH * scale) / 2 + (hotspot.x + shift) * scale,
      top: (dims.height - VIEWBOX_HEIGHT * scale) / 2 + hotspot.y * scale,
    };
  };

  const active = hotspots.find((hotspot) => hotspot.id === activeHotspot) ?? null;

  /** Merges the hotspot's own filter with the stay currently being searched. */
  const hotspotHref = (hotspot: Hotspot): string => {
    const [path, query] = hotspot.href.split('?');
    const params = new URLSearchParams(query ?? '');
    if (stayQuery) {
      new URLSearchParams(stayQuery).forEach((value, key) => params.set(key, value));
    }
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={stageRef}
        role="group"
        aria-label="Interactive view of Asteria Cove. Drag or use the left and right arrow keys to change the camera angle."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="relative size-full cursor-grab touch-pan-y overflow-hidden rounded-3xl bg-ink select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan active:cursor-grabbing"
      >
        {mode === 'three' ? (
          <React.Suspense
            fallback={
              <>
                <ResortMassing className="absolute inset-0 size-full" orbit={orbit} />
                <p
                  role="status"
                  className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-ink/55 text-sm font-medium text-[#F2F1EC] backdrop-blur-[2px]"
                >
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading the 3D scene…
                </p>
              </>
            }
          >
            <SceneBoundary
              onError={() => {
                setThreeFailed(true);
                setMode('poster');
              }}
            >
              <ResortCanvas
                hotspots={hotspots.map(({ id, label, position }) => ({ id, label, position }))}
                activeHotspot={activeHotspot}
                onSelectHotspot={setActiveHotspot}
                autoRotate={autoRotate && !reducedMotion}
              />
            </SceneBoundary>
          </React.Suspense>
        ) : (
          <ResortMassing className="absolute inset-0 size-full" orbit={orbit} />
        )}

        {mode === 'poster' &&
          hotspots.map((hotspot) => {
          const isActive = hotspot.id === activeHotspot;
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-pressed={isActive}
              aria-label={hotspot.label}
              onClick={() => setActiveHotspot(isActive ? null : hotspot.id)}
              style={positionFor(hotspot)}
              className={cn(
                'absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors',
                'sm:size-auto sm:min-h-11 sm:justify-start sm:gap-2 sm:border sm:py-1.5 sm:pr-3.5 sm:pl-2 sm:text-xs sm:font-semibold sm:whitespace-nowrap sm:backdrop-blur-sm',
                isActive
                  ? 'sm:border-cyan sm:bg-cyan sm:text-ink'
                  : 'sm:border-[#F2F1EC]/25 sm:bg-ink/70 sm:text-[#F2F1EC] sm:hover:border-cyan sm:hover:text-cyan',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-7 place-items-center rounded-full border backdrop-blur-sm sm:size-5 sm:border-0 sm:backdrop-blur-none',
                  isActive
                    ? 'border-cyan bg-cyan sm:bg-ink/15'
                    : 'border-[#F2F1EC]/40 bg-ink/75 sm:bg-cyan/20',
                )}
              >
                <span className={cn('size-1.5 rounded-full', isActive ? 'bg-ink' : 'bg-cyan')} />
              </span>
              <span className="hidden sm:inline">{hotspot.label}</span>
            </button>
          );
        })}

        {/* Camera controls */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-2xl border border-[#F2F1EC]/15 bg-ink/75 p-1 backdrop-blur-sm">
          {mode === 'poster' ? (
            <div className="hidden items-center gap-1 sm:flex">
              <SceneButton label="Rotate view left" onClick={() => nudge(-0.2)}>
                <ChevronLeft className="size-4" />
              </SceneButton>
              <SceneButton label="Rotate view right" onClick={() => nudge(0.2)}>
                <ChevronRight className="size-4" />
              </SceneButton>
            </div>
          ) : null}
          <SceneButton
            label={mode === 'three' ? 'Switch back to the fast preview' : 'Load the 3D scene'}
            pressed={mode === 'three'}
            disabled={threeFailed}
            onClick={() => {
              setMode((current) => (current === 'three' ? 'poster' : 'three'));
              setOrbit(0);
            }}
          >
            <Boxes className="size-4" />
            <span className="text-[11px] font-semibold">3D</span>
          </SceneButton>
          <SceneButton
            label={autoRotate ? 'Stop the 360° orbit' : 'Start the 360° orbit'}
            pressed={autoRotate}
            disabled={reducedMotion}
            onClick={() => setAutoRotate((value) => !value)}
          >
            <Orbit className="size-4" />
            <span className="text-[11px] font-semibold">360°</span>
          </SceneButton>
          {mode === 'poster' ? (
            <SceneButton
              label="Reset the camera angle"
              onClick={() => {
                setAutoRotate(false);
                setOrbit(0);
              }}
            >
              <RotateCcw className="size-4" />
            </SceneButton>
          ) : null}
          <SceneButton
            label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </SceneButton>
        </div>

        {/* Hotspot detail. Anchored rather than floating so it never covers the subject. */}
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-x-3 bottom-3 z-20 sm:right-auto sm:max-w-[21rem]"
        >
          {active ? (
            <div className="pointer-events-auto rounded-2xl border border-[#F2F1EC]/15 bg-ink/85 p-4 text-[#F2F1EC] backdrop-blur-md">
              <p className="eyebrow text-cyan">{active.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#D6D8D3]">{active.description}</p>
              <Link
                href={hotspotHref(active)}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-cyan px-3.5 text-sm font-semibold text-ink hover:bg-cyan/85"
              >
                {active.cta}
                <ChevronRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#F2F1EC]/15 bg-ink/70 px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-[#A4ABAC] uppercase backdrop-blur-sm">
                {mode === 'three' ? 'Procedural 3D' : 'Procedural preview'}
              </span>
              {threeFailed ? (
                <span
                  role="status"
                  className="rounded-full border border-warning/40 bg-ink/70 px-3 py-1.5 text-xs text-warning backdrop-blur-sm"
                >
                  3D is unavailable in this browser.
                </span>
              ) : null}
              <span className="rounded-full border border-[#F2F1EC]/15 bg-ink/70 px-3.5 py-1.5 text-xs text-[#A4ABAC] backdrop-blur-sm">
                Drag to look around, or open a hotspot.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SceneButton({
  label,
  children,
  onClick,
  pressed,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-2.5 transition-colors',
        pressed ? 'bg-cyan text-ink' : 'text-[#F2F1EC] hover:bg-[#F2F1EC]/12',
        disabled && 'opacity-40 hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
