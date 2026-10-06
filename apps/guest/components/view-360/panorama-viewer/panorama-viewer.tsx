'use client';

import * as React from 'react';
import type { CardAnchor } from '@/components/site/use-anchored-card';
import { loadPannellum, type PannellumViewer } from './pannellum';
import { hitTest, isClick, type ScreenPolygon } from './sphere-geometry';
import { cornerHotSpots, markerHotSpot } from './sphere-hotspots';
import { PanoramaPlaceholder, SphereOutlines } from './sphere-overlay';
import { trackProjectedShapes, type ProjectedElements } from './track-projected-shapes';
import type { PanoramaApi, PanoramaHotSpot, PanoramaOutline, PanoramaStatus } from './types';

export interface PanoramaViewerProps {
  /** An equirectangular (2:1) image. */
  src: string;
  /** Read by assistive tech only — never painted over the sphere. */
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
  apiRef?: React.RefObject<PanoramaApi | null>;
  /** Opening camera, in degrees. Defaults to level, straight ahead. */
  view?: { yaw: number; pitch: number; hfov?: number };
  /**
   * Whether to paint a loading/error state of its own. Off when the sphere
   * is layered over a photograph of the same place, which then does that job.
   */
  placeholder?: boolean;
  className?: string;
}

/**
 * A draggable 360° sphere — the "look around" a flat photograph cannot give —
 * seen from one fixed point inside a place. (The building spinner is the
 * opposite camera: it orbits the outside.) Drag, wheel and pinch come from
 * Pannellum (`pannellum.ts`); markers, outlines, loading and failure are the
 * product's own.
 *
 * The sphere is built once per `src`/`title`. Everything else it is handed is
 * read through a ref, so a re-render with a new callback never rebuilds it.
 */
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
  const [status, setStatus] = React.useState<PanoramaStatus>('loading');
  const [polygons, setPolygons] = React.useState<Record<string, ScreenPolygon>>({});
  const polygonsRef = React.useRef(polygons);
  polygonsRef.current = polygons;

  const latest = React.useRef({ hotSpots, onHotSpot, outlines, activeHotSpotId, onActiveHotSpotRect, view });
  latest.current = { hotSpots, onHotSpot, outlines, activeHotSpotId, onActiveHotSpotRect, view };

  React.useEffect(() => {
    let cancelled = false;
    let viewer: PannellumViewer | null = null;
    let observer: ResizeObserver | undefined;
    let stopTracking = () => {};
    const elements: ProjectedElements = { corners: {}, markers: {} };

    loadPannellum()
      .then(() => {
        const container = containerRef.current;
        if (cancelled || !container || !window.pannellum) return;

        const create = () => {
          if (cancelled || viewer || !window.pannellum) return;
          const props = latest.current;
          // The title is for assistive tech only: handed to Pannellum it would
          // paint its own caption box in its own style over the sphere.
          container.setAttribute('aria-label', title);
          const created = window.pannellum.viewer(container, {
            type: 'equirectangular',
            panorama: src,
            autoLoad: true,
            yaw: props.view?.yaw ?? 0,
            pitch: props.view?.pitch ?? 0,
            hfov: props.view?.hfov ?? 100,
            // The library's own grey chrome collides with the gallery's own
            // controls and ignores the design system. Drag, wheel and pinch
            // still work; fullscreen is the gallery's button.
            showControls: false,
            compass: false,
            hotSpots: [
              ...(props.hotSpots ?? []).map((spot) =>
                markerHotSpot(
                  spot,
                  (element) => {
                    elements.markers[spot.id] = element;
                  },
                  () => latest.current.onHotSpot?.(spot.id),
                ),
              ),
              ...(props.outlines ?? []).flatMap((outline) =>
                cornerHotSpots(outline, (key, element) => {
                  elements.corners[key] = element;
                }),
              ),
            ],
          });
          created.on('load', () => {
            if (!cancelled) setStatus('ready');
          });
          created.on('error', () => {
            if (!cancelled) setStatus('error');
          });
          viewer = created;
          if (apiRef) apiRef.current = { rotate: (degrees) => created.setYaw(created.getYaw() + degrees, 600) };
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
          if (viewer) viewer.resize();
          else create();
        });
        observer.observe(container);

        stopTracking = trackProjectedShapes({
          container,
          elements,
          outlines: () => latest.current.outlines ?? [],
          activeMarkerId: () => latest.current.activeHotSpotId,
          onPolygons: setPolygons,
          onActiveAnchor: (anchor) => latest.current.onActiveHotSpotRect?.(anchor),
        });
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      stopTracking();
      observer?.disconnect();
      viewer?.destroy();
      if (apiRef) apiRef.current = null;
    };
    // `apiRef` is a stable ref object; the sphere rebuilds only for a new picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, title]);

  // Hover and click on an outline are found by hit-testing the projected shapes.
  const pressed = React.useRef<{ x: number; y: number } | null>(null);
  const hovered = React.useRef<string | null>(null);

  const outlineAt = (event: React.MouseEvent): string | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    return hitTest(polygonsRef.current, event.clientX - rect.left, event.clientY - rect.top);
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!onOutlineHover) return;
    const id = outlineAt(event);
    if (id !== hovered.current) {
      hovered.current = id;
      onOutlineHover(id);
    }
  };

  const onMouseLeave = () => {
    if (hovered.current !== null) {
      hovered.current = null;
      onOutlineHover?.(null);
    }
  };

  const onMouseDown = (event: React.MouseEvent) => {
    pressed.current = { x: event.clientX, y: event.clientY };
  };

  const onClick = (event: React.MouseEvent) => {
    const start = pressed.current;
    pressed.current = null;
    if (!start || !isClick(start, { x: event.clientX, y: event.clientY })) return;
    const id = outlineAt(event);
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
        <SphereOutlines polygons={polygons} lit={litOutlines} />
        {placeholder && status !== 'ready' ? <PanoramaPlaceholder status={status} /> : null}
      </div>
    </div>
  );
}
