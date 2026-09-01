'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Orbit,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResortMassing } from './resort-massing';

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 700;

interface Hotspot {
  id: string;
  label: string;
  description: string;
  href: string;
  cta: string;
  /** Position in scene coordinates, plus the parallax layer it belongs to. */
  x: number;
  y: number;
  depth: number;
}

const hotspots: Hotspot[] = [
  {
    id: 'sea-view',
    label: 'Sea view',
    description:
      'Floors three and up face the open cove. Every sea-view room has a full-width balcony and a west-facing sunset.',
    href: '/rooms?view=sea',
    cta: 'See sea-view rooms',
    x: 700,
    y: 206,
    depth: 0.32,
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
  const dragState = React.useRef<{ pointerId: number; startX: number; startOrbit: number } | null>(
    null,
  );

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
    if (event.button !== 0) return;
    setAutoRotate(false);
    dragState.current = { pointerId: event.pointerId, startX: event.clientX, startOrbit: orbit };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
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
        <ResortMassing className="absolute inset-0 size-full" orbit={orbit} />

        {hotspots.map((hotspot) => {
          const isActive = hotspot.id === activeHotspot;
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveHotspot(isActive ? null : hotspot.id)}
              style={positionFor(hotspot)}
              className={cn(
                'absolute z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2 text-xs font-semibold whitespace-nowrap backdrop-blur-sm transition-colors',
                isActive
                  ? 'border-cyan bg-cyan text-ink'
                  : 'border-[#F2F1EC]/25 bg-ink/70 text-[#F2F1EC] hover:border-cyan hover:text-cyan',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-5 place-items-center rounded-full',
                  isActive ? 'bg-ink/15' : 'bg-cyan/20',
                )}
              >
                <span className={cn('size-1.5 rounded-full', isActive ? 'bg-ink' : 'bg-cyan')} />
              </span>
              {hotspot.label}
            </button>
          );
        })}

        {/* Camera controls */}
        <div className="absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-2xl border border-[#F2F1EC]/15 bg-ink/75 p-1 backdrop-blur-sm">
          <SceneButton label="Rotate view left" onClick={() => nudge(-0.2)}>
            <ChevronLeft className="size-4" />
          </SceneButton>
          <SceneButton label="Rotate view right" onClick={() => nudge(0.2)}>
            <ChevronRight className="size-4" />
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
          <SceneButton
            label="Reset the camera angle"
            onClick={() => {
              setAutoRotate(false);
              setOrbit(0);
            }}
          >
            <RotateCcw className="size-4" />
          </SceneButton>
          <SceneButton
            label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </SceneButton>
        </div>

        <p className="pointer-events-none absolute top-3 left-3 z-20 rounded-full border border-[#F2F1EC]/15 bg-ink/70 px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-[#A4ABAC] uppercase backdrop-blur-sm">
          Procedural preview
        </p>

        {/* Hotspot detail. Anchored rather than floating so it never covers the subject. */}
        <div aria-live="polite" className="absolute bottom-3 left-3 z-20 max-w-[min(21rem,calc(100%-1.5rem))]">
          {active ? (
            <div className="rounded-2xl border border-[#F2F1EC]/15 bg-ink/85 p-4 text-[#F2F1EC] backdrop-blur-md">
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
            <p className="rounded-2xl border border-[#F2F1EC]/15 bg-ink/70 px-3.5 py-2.5 text-xs text-[#A4ABAC] backdrop-blur-sm">
              Drag to look around, or open a hotspot.
            </p>
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
