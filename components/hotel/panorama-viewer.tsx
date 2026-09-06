'use client';

import * as React from 'react';
import { ArrowsClockwise, Warning } from '@phosphor-icons/react/dist/ssr';
import type { CardAnchor } from '@/components/hotel/use-anchored-card';
import { cn } from '@/lib/utils';

/**
 * A draggable 360° sphere — the "Google Maps look around" interaction a flat
 * photograph cannot give. Wraps Pannellum, vendored at `/vendor/pannellum`
 * as plain script + stylesheet (see CREDITS.md): it is a global, not an ES
 * module, so it is loaded as a real `<script>` tag rather than imported, and
 * only once per page no matter how many viewers mount.
 */

declare global {
  interface Window {
    pannellum?: {
      viewer: (container: HTMLElement, config: Record<string, unknown>) => PannellumViewer;
    };
  }
}

interface PannellumViewer {
  on: (event: string, handler: () => void) => PannellumViewer;
  getYaw: () => number;
  setYaw: (yaw: number, animated?: number | boolean) => PannellumViewer;
  resize: () => void;
  destroy: () => void;
}

export interface PanoramaHotSpot {
  id: string;
  label: string;
  /** A second, quieter line — the floor and the price — so the pill stays narrow. */
  detail?: string | null;
  /** Degrees; yaw is left–right around the horizon, pitch is up–down. */
  yaw: number;
  pitch: number;
}

/** A footprint drawn on the sphere: its corners in degrees, in drawing order. */
export interface PanoramaOutline {
  id: string;
  points: { yaw: number; pitch: number }[];
}

/** What a parent may drive after the sphere is up. */
export interface PanoramaApi {
  /** Turn the view by so many degrees, eased; positive is to the right. */
  rotate: (degrees: number) => void;
}

interface PanoramaViewerProps {
  src: string;
  title: string;
  /** Markers inside the sphere, styled as the product's own pills. */
  hotSpots?: PanoramaHotSpot[];
  onHotSpot?: (id: string) => void;
  /** Footprints that stay glued to what they trace while the view turns. */
  outlines?: PanoramaOutline[];
  /** Which footprints to draw lit; the rest stay invisible until hovered. */
  litOutlines?: string[];
  onOutlineHover?: (id: string | null) => void;
  onOutlineClick?: (id: string) => void;
  /**
   * The marker whose card is open, so its on-screen position can be tracked
   * as the view turns — a card that opened beside a marker and stayed put
   * while the guest kept dragging would end up nowhere near it.
   */
  activeHotSpotId?: string | null;
  onActiveHotSpotRect?: (rect: CardAnchor | null) => void;
  apiRef?: React.MutableRefObject<PanoramaApi | null>;
  /** Opening camera, in degrees. Defaults to level, straight ahead. */
  view?: { yaw: number; pitch: number; hfov?: number };
  /**
   * Whether to paint a loading/error state of its own. Off when the sphere
   * is layered over a photograph of the same place, which then does that job.
   */
  placeholder?: boolean;
  className?: string;
}

const VENDOR_BASE = '/vendor/pannellum';
let loadPromise: Promise<void> | null = null;

function loadPannellum(): Promise<void> {
  if (window.pannellum) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${VENDOR_BASE}/pannellum.css"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${VENDOR_BASE}/pannellum.css`;
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = `${VENDOR_BASE}/pannellum.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load the panorama viewer.'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

/** Class names are written out in full here so Tailwind emits them. */
const MARKER_CLASS =
  'pnlm-marker glass flex items-center gap-2 rounded-full py-2 pr-3.5 pl-3 text-sm font-medium whitespace-nowrap text-foreground shadow-soft';

/** Pannellum positions a hotspot with `translate(Xpx, Ypx)`; read that back. */
const TRANSLATE = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/;

/** Ray casting: is the point inside the polygon? Standard even–odd rule. */
function contains(polygon: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function PanoramaViewer({
  src,
  title,
  hotSpots,
  onHotSpot,
  outlines,
  litOutlines,
  onOutlineHover,
  onOutlineClick,
  activeHotSpotId,
  onActiveHotSpotRect,
  apiRef,
  view,
  placeholder = true,
  className,
}: PanoramaViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<PannellumViewer | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');

  // Everything Pannellum is handed at construction is read through refs, so a
  // re-render with a new callback never has to rebuild the sphere.
  const onHotSpotRef = React.useRef(onHotSpot);
  onHotSpotRef.current = onHotSpot;
  const hotSpotsRef = React.useRef(hotSpots);
  hotSpotsRef.current = hotSpots;
  const outlinesRef = React.useRef(outlines);
  outlinesRef.current = outlines;
  const activeIdRef = React.useRef(activeHotSpotId);
  activeIdRef.current = activeHotSpotId;
  const onActiveRectRef = React.useRef(onActiveHotSpotRect);
  onActiveRectRef.current = onActiveHotSpotRect;

  /**
   * Outlines are drawn from invisible corner hotspots: Pannellum projects each
   * corner onto the screen every frame, and we read the projected positions
   * back into an SVG. Nothing here re-implements the projection maths.
   *
   * The active marker's card anchor is read the same way, off the real
   * hotspot element Pannellum already positions every frame.
   */
  const cornerEls = React.useRef<Record<string, HTMLElement>>({});
  const markerEls = React.useRef<Record<string, HTMLElement>>({});
  const [polygons, setPolygons] = React.useState<Record<string, [number, number][]>>({});
  const polygonsRef = React.useRef(polygons);
  polygonsRef.current = polygons;

  React.useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let lastKey = '';
    let lastActiveKey = '';

    const track = () => {
      const next: Record<string, [number, number][]> = {};
      for (const outline of outlinesRef.current ?? []) {
        const points: [number, number][] = [];
        for (let i = 0; i < outline.points.length; i++) {
          const el = cornerEls.current[`${outline.id}:${i}`];
          // Behind the camera Pannellum hides the corner; the whole shape goes.
          if (!el || el.style.visibility === 'hidden') break;
          const match = TRANSLATE.exec(el.style.transform);
          if (!match) break;
          points.push([Number(match[1]), Number(match[2])]);
        }
        if (points.length === outline.points.length) next[outline.id] = points;
      }
      const key = JSON.stringify(next);
      if (key !== lastKey) {
        lastKey = key;
        setPolygons(next);
      }

      const activeId = activeIdRef.current;
      const markerEl = activeId ? markerEls.current[activeId] : undefined;
      const container = containerRef.current;
      let activeKey = 'none';
      if (markerEl && container && markerEl.style.visibility !== 'hidden') {
        const containerRect = container.getBoundingClientRect();
        const elRect = markerEl.getBoundingClientRect();
        const rect: CardAnchor = {
          x: elRect.left - containerRect.left + elRect.width / 2,
          top: elRect.top - containerRect.top,
          bottom: elRect.bottom - containerRect.top,
        };
        activeKey = JSON.stringify(rect);
        if (activeKey !== lastActiveKey) {
          lastActiveKey = activeKey;
          onActiveRectRef.current?.(rect);
        }
      } else if (lastActiveKey !== 'none') {
        lastActiveKey = 'none';
        onActiveRectRef.current?.(null);
      }

      frame = requestAnimationFrame(track);
    };

    loadPannellum()
      .then(() => {
        const container = containerRef.current;
        if (cancelled || !container || !window.pannellum) return;

        const create = () => {
          if (cancelled || viewerRef.current || !window.pannellum) return;
          // The title is for assistive tech only: handed to Pannellum it would
          // paint its own caption box in its own style over the sphere.
          container.setAttribute('aria-label', title);
          const viewer = window.pannellum.viewer(container, {
            type: 'equirectangular',
            panorama: src,
            autoLoad: true,
            yaw: view?.yaw ?? 0,
            pitch: view?.pitch ?? 0,
            hfov: view?.hfov ?? 100,
            // The library's own grey chrome collides with the gallery's own
            // controls and ignores the design system. Drag, wheel and pinch
            // still work; fullscreen is the gallery's button.
            showControls: false,
            compass: false,
            hotSpots: [
              ...(hotSpotsRef.current ?? []).map((spot) => ({
                id: spot.id,
                yaw: spot.yaw,
                pitch: spot.pitch,
                cssClass: MARKER_CLASS,
                createTooltipFunc: (element: HTMLElement, text: { label: string; detail?: string | null }) => {
                  markerEls.current[spot.id] = element;
                  const dot = document.createElement('span');
                  dot.className = 'size-2 shrink-0 rounded-full bg-accent';
                  dot.setAttribute('aria-hidden', 'true');
                  const column = document.createElement('span');
                  column.className = 'flex flex-col leading-tight';
                  const label = document.createElement('span');
                  label.textContent = text.label;
                  column.appendChild(label);
                  if (text.detail) {
                    const detail = document.createElement('span');
                    detail.className = 'text-xs font-normal text-muted-foreground';
                    detail.textContent = text.detail;
                    column.appendChild(detail);
                  }
                  // `appendChild`, not `append`: the Workers types merge an
                  // HTMLRewriter `append(string | Response)` into `Element`.
                  element.appendChild(dot);
                  element.appendChild(column);
                  element.setAttribute('role', 'button');
                  element.tabIndex = 0;
                },
                createTooltipArgs: { label: spot.label, detail: spot.detail },
                clickHandlerFunc: () => onHotSpotRef.current?.(spot.id),
              })),
              ...(outlinesRef.current ?? []).flatMap((outline) =>
                outline.points.map((point, i) => ({
                  id: `corner:${outline.id}:${i}`,
                  yaw: point.yaw,
                  pitch: point.pitch,
                  cssClass: 'pnlm-vertex',
                  createTooltipFunc: (element: HTMLElement, key: string) => {
                    cornerEls.current[key] = element;
                  },
                  createTooltipArgs: `${outline.id}:${i}`,
                })),
              ),
            ],
          });
          viewer.on('load', () => {
            if (!cancelled) setStatus('ready');
          });
          viewer.on('error', () => {
            if (!cancelled) setStatus('error');
          });
          viewerRef.current = viewer;
          if (apiRef) {
            apiRef.current = {
              rotate: (degrees) => viewer.setYaw(viewer.getYaw() + degrees, 600),
            };
          }
        };

        /**
         * Pannellum measures the container once, when it is constructed, and
         * afterwards only listens for `window.resize`. Built against a box
         * that is still 0×0 — a collapsed parent, a panel that opens later,
         * a tab restored in the background — it would render a zero-size
         * canvas and never recover.
         *
         * So build as soon as the box is real, and keep the canvas in step
         * with it afterwards. The observer is the fallback for "real later",
         * never the only path in: its first delivery is not guaranteed for
         * an element that is not being rendered yet.
         */
        const hasBox = () => {
          const { width, height } = container.getBoundingClientRect();
          return width > 0 && height > 0;
        };

        if (hasBox()) create();

        observer = new ResizeObserver(() => {
          if (!hasBox()) return;
          if (viewerRef.current) viewerRef.current.resize();
          else create();
        });
        observer.observe(container);

        // Runs continuously rather than only while outlines exist: which
        // marker (if any) is active can change at any time, independent of
        // this effect, and its position has to stay current every frame.
        frame = requestAnimationFrame(track);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      viewerRef.current?.destroy();
      viewerRef.current = null;
      cornerEls.current = {};
      markerEls.current = {};
      if (apiRef) apiRef.current = null;
    };
    // `apiRef` is a stable ref object; the sphere rebuilds only for a new picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, title]);

  /**
   * The outlines never take the pointer — a drag that starts on a building
   * must still turn the view — so hover and click are found by hit-testing
   * the projected shapes instead.
   */
  const pressed = React.useRef<{ x: number; y: number } | null>(null);
  const hoveredRef = React.useRef<string | null>(null);

  const hitTest = (event: React.MouseEvent): string | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    for (const [id, polygon] of Object.entries(polygonsRef.current)) {
      if (contains(polygon, x, y)) return id;
    }
    return null;
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!onOutlineHover) return;
    const id = hitTest(event);
    if (id !== hoveredRef.current) {
      hoveredRef.current = id;
      onOutlineHover(id);
    }
  };

  const onMouseLeave = () => {
    if (hoveredRef.current !== null) {
      hoveredRef.current = null;
      onOutlineHover?.(null);
    }
  };

  const onMouseDown = (event: React.MouseEvent) => {
    pressed.current = { x: event.clientX, y: event.clientY };
  };

  const onClick = (event: React.MouseEvent) => {
    const start = pressed.current;
    pressed.current = null;
    // A drag ends in a click too; only a press that did not travel selects.
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const id = hitTest(event);
    if (id) onOutlineClick?.(id);
  };

  return (
    <div className={className}>
      <div
        className="relative size-full"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onClick={onClick}
      >
        {/* Pannellum owns this node entirely once it mounts — React never renders
            children into it, so the two never fight over the same DOM. */}
        <div ref={containerRef} className="absolute inset-0" />

        {Object.keys(polygons).length > 0 ? (
          <svg className="pointer-events-none absolute inset-0 z-10 size-full" aria-hidden="true">
            {Object.entries(polygons).map(([id, points]) => {
              const lit = litOutlines?.includes(id) ?? false;
              return (
                <polygon
                  key={id}
                  points={points.map(([x, y]) => `${x},${y}`).join(' ')}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  className={cn(
                    'transition-[fill,stroke] duration-200',
                    lit
                      ? 'fill-white/20 stroke-accent [filter:drop-shadow(0_1px_4px_rgb(22_22_22/0.45))]'
                      : 'fill-transparent stroke-white/35',
                  )}
                />
              );
            })}
          </svg>
        ) : null}

        {placeholder && status !== 'ready' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone text-sm text-muted-foreground">
            {status === 'loading' ? (
              <>
                <ArrowsClockwise weight="bold" className="size-5 animate-spin" aria-hidden="true" />
                Loading the 360° view…
              </>
            ) : (
              <>
                <Warning weight="fill" className="size-5" aria-hidden="true" />
                This browser could not display the 360° view.
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
