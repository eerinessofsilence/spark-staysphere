'use client';

import * as React from 'react';
import { toPathData, type Polygon } from '@/lib/domain/polygon/geometry';

// ONE component for editing and for viewing, switched by the `editable` prop.
// Two separate rendering paths is the classic bug in projects like this: a
// polygon that sits right in the editor but drifts in the viewer. So there is
// exactly one.
//
// Markup: a `position: relative` container, an `<img>` inside it with
// `object-fit: contain`, and an `<svg>` on top with the same transform — a
// `viewBox` in the original's pixels and `preserveAspectRatio="xMidYMid
// meet"`. Their letterboxing then matches by construction.
//
// HTML image maps (`<map>`/`<area>`) are not used: they are absolute pixels
// and break on a responsive layout.
//
// Ported from `svg-editor-kit`'s `client/markup-canvas.jsx`.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const FILL: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

export interface ImageSize {
  url: string;
  width: number;
  height: number;
}

export interface MarkupItem {
  id: string;
  polygon: Polygon;
}

/**
 * Screen point → normalized `[0..1]` coordinates.
 *
 * Through `getScreenCTM`, not `getBoundingClientRect` with manual
 * subtraction: the matrix already accounts for both `preserveAspectRatio`
 * and the CSS-transform zoom. Hand arithmetic breaks here first.
 */
export function screenToNormalized(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  image: ImageSize,
): [number, number] | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  const user = point.matrixTransform(ctm.inverse());
  return [user.x / image.width, user.y / image.height];
}

// A separate memoized component: at 500 polygons, React must not touch the
// ones nothing changed about.
//
// `<path>`, not `<polygon>`: a polygon's sides are only straight, and a
// rounded side is a quadratic curve. A straight contour in a path is the
// same segments.
const MarkupShape = React.memo(function MarkupShape<T extends MarkupItem>({
  item,
  image,
  className,
  label,
  interactive,
}: {
  item: T;
  image: ImageSize;
  className: string;
  label: string | null;
  interactive: boolean;
}) {
  return (
    <path
      data-hotspot-id={item.id}
      d={toPathData(item.polygon, image.width, image.height)}
      className={className}
      // Polygons are tabbable, with a label a screen reader can read.
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'link' : undefined}
      aria-label={label ?? undefined}
    />
  );
}) as <T extends MarkupItem>(props: { item: T; image: ImageSize; className: string; label: string | null; interactive: boolean }) => React.ReactElement;

export interface MarkupCanvasProps<T extends MarkupItem> {
  image: ImageSize;
  items?: T[];
  editable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  selectedId?: string | null;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  itemClassName?: (item: T, isSelected: boolean) => string;
  itemLabel?: (item: T) => string | null;
  background?: string;
  onItemClick?: (item: T, event: React.MouseEvent | React.KeyboardEvent) => void;
  onBackgroundPointerDown?: (event: React.PointerEvent) => void;
  onPointerMoveCanvas?: (event: React.PointerEvent) => void;
  onPointerUpCanvas?: (event: React.PointerEvent) => void;
  onViewChange?: (view: { zoom: number; svg: SVGSVGElement | null }) => void;
  panLocked?: boolean;
  cursor?: string;
  children?: React.ReactNode;
}

interface ViewState {
  zoom: number;
  x: number;
  y: number;
}

/**
 * An image with an SVG overlay of polygons, wheel zoom, and panning.
 *
 * `image` — `{ url, width, height }`: width/height are the image's natural
 * pixels, and all coordinate normalization rests on them.
 * `items` — `[{ id, polygon }]`.
 *
 * In view mode (`editable=false`), polygons are coloured through
 * `itemClassName`; the default is `hs`, an invisible but clickable area. For
 * a visible fill, pass `'hs hs-shape hs-clickable'` — colours come from CSS
 * variables (see `EDITOR_STYLES`).
 */
export function MarkupCanvas<T extends MarkupItem>({
  image,
  items = [],
  editable = false,
  className = '',
  style,
  selectedId = null,
  svgRef: externalSvgRef,
  itemClassName,
  itemLabel,
  background = '#171717',
  onItemClick,
  onBackgroundPointerDown,
  onPointerMoveCanvas,
  onPointerUpCanvas,
  onViewChange,
  panLocked = false,
  cursor,
  children,
}: MarkupCanvasProps<T>) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const localSvgRef = React.useRef<SVGSVGElement>(null);
  const svgRef = externalSvgRef ?? localSvgRef;

  const [view, setView] = React.useState<ViewState>({ zoom: 1, x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = React.useState(false);
  const [panning, setPanning] = React.useState(false);
  const [tooltipLabel, setTooltipLabel] = React.useState<string | null>(null);
  const panRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: ViewState;
    moved: boolean;
    captured: boolean;
  } | null>(null);
  const suppressClickRef = React.useRef(false);
  const tooltipRef = React.useRef<{ label: string | null; node: HTMLSpanElement | null }>({ label: null, node: null });

  const clampPan = React.useCallback((next: ViewState): ViewState => {
    const viewport = viewportRef.current;
    if (!viewport) return next;

    const { width, height } = viewport.getBoundingClientRect();
    const spanX = width * (next.zoom - 1);
    const spanY = height * (next.zoom - 1);

    return { zoom: next.zoom, x: clamp(next.x, -spanX, 0), y: clamp(next.y, -spanY, 0) };
  }, []);

  // Wheel zoom anchored on the cursor: the point under the cursor stays put.
  const onWheel = React.useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;

      setView((current) => {
        const factor = Math.exp(-event.deltaY * 0.0015);
        const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (zoom === current.zoom) return current;

        const ratio = zoom / current.zoom;
        return clampPan({ zoom, x: cursorX - (cursorX - current.x) * ratio, y: cursorY - (cursorY - current.y) * ratio });
      });
    },
    [clampPan],
  );

  // The wheel listener is attached manually: React's onWheel is passive, and
  // preventDefault inside it will not stop the page from scrolling.
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // The editor needs a live scale: handle size is computed in user units but
  // must stay constant on screen. Reported on zoom and on resize —
  // letterboxing depends on both.
  React.useEffect(() => {
    if (!onViewChange) return undefined;

    const report = () => onViewChange({ zoom: view.zoom, svg: svgRef.current });
    report();

    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(report);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [view.zoom, onViewChange, svgRef]);

  // Space bar — a temporary pan mode.
  React.useEffect(() => {
    if (!editable) return undefined;

    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;

      // An editor embedded in someone else's page must not steal their space
      // bar: panning only works while focus is inside the editor (data-pe-root).
      const viewport = viewportRef.current;
      const scope = viewport?.closest('[data-pe-root]') ?? viewport;
      if (!scope?.contains(target)) return;

      event.preventDefault();
      setSpaceHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false);
    };
    const blur = () => setSpaceHeld(false);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [editable]);

  // In view mode, panning works with the left button; in the editor, only
  // space or the middle button — otherwise panning fights the tools.
  const panTrigger = (event: React.PointerEvent) =>
    !panLocked && (event.button === 1 || spaceHeld || (!editable && event.button === 0));

  function onPointerDown(event: React.PointerEvent) {
    if (panTrigger(event)) {
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: view,
        moved: false,
        captured: false,
      };
      // Pointer capture is NOT taken here. In view mode panning rides the
      // left button — every click — and capturing would redirect the
      // following `click` to the capturing element, so a click on a polygon
      // would land on the root div instead of the `<path>`. Capture is only
      // taken once dragging has actually started (see onPointerMove).
      return;
    }

    if (editable) onBackgroundPointerDown?.(event);
  }

  function onPointerMove(event: React.PointerEvent) {
    const pan = panRef.current;

    if (pan && pan.pointerId === event.pointerId) {
      const dx = event.clientX - pan.startX;
      const dy = event.clientY - pan.startY;

      if (!pan.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        pan.moved = true;
        setPanning(true);
        // Capture is needed now: without it, the cursor leaving the canvas
        // cuts the drag short.
        event.currentTarget.setPointerCapture(event.pointerId);
        pan.captured = true;
      }

      if (pan.moved) {
        setView(clampPan({ zoom: pan.origin.zoom, x: pan.origin.x + dx, y: pan.origin.y + dy }));
      }
      return;
    }

    updateTooltip(event);
    onPointerMoveCanvas?.(event);
  }

  function onPointerUp(event: React.PointerEvent) {
    const pan = panRef.current;

    if (pan && pan.pointerId === event.pointerId) {
      // A click after a drag is not a click. Otherwise panning across a
      // polygon would fire as a click on it.
      const moved = pan.moved;
      panRef.current = null;
      setPanning(false);
      // Only release what was actually captured: a plain click never captured anything.
      if (pan.captured) event.currentTarget.releasePointerCapture?.(event.pointerId);
      // The flag lives until the end of the current event cycle: click fires after pointerup.
      if (moved) {
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        return;
      }
    }

    onPointerUpCanvas?.(event);
  }

  // ── the cursor label ──────────────────────────────────────────────────
  //
  // The text lives in state and only changes when the polygon under the
  // cursor changes; the position is written straight to the DOM. Otherwise,
  // with 500 polygons on the image, every mouse move would re-render the
  // whole tree.

  function updateTooltip(event: React.PointerEvent) {
    if (!itemLabel) return;

    const target = event.target as HTMLElement;
    const node = target.closest?.('[data-hotspot-id]') as HTMLElement | null;
    const item = node ? items.find((entry) => entry.id === node.dataset.hotspotId) : null;
    const label = item ? itemLabel(item) : null;

    if (label !== tooltipRef.current.label) {
      tooltipRef.current.label = label;
      setTooltipLabel(label);
    }
    if (!label) return;

    const viewport = viewportRef.current;
    const box = tooltipRef.current.node;
    if (!viewport || !box) return;

    const rect = viewport.getBoundingClientRect();
    box.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`;
  }

  function clearTooltip() {
    if (tooltipRef.current.label === null) return;
    tooltipRef.current.label = null;
    setTooltipLabel(null);
  }

  /** One delegated handler on the svg root — not a listener on every polygon. */
  function itemFrom(event: React.MouseEvent | React.KeyboardEvent): T | null {
    const target = event.target as HTMLElement;
    const node = target.closest?.('[data-hotspot-id]') as HTMLElement | null;
    if (!node) return null;
    return items.find((entry) => entry.id === node.dataset.hotspotId) ?? null;
  }

  function onSvgClick(event: React.MouseEvent) {
    if (suppressClickRef.current) return;
    const item = itemFrom(event);
    if (item) onItemClick?.(item, event);
  }

  /** Enter and space on a polygon act as a click — keyboard navigation. */
  function onSvgKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = itemFrom(event);
    if (!item) return;
    event.preventDefault();
    onItemClick?.(item, event);
  }

  const rendered = React.useMemo(
    () =>
      items.map((item) => {
        const className = itemClassName?.(item, item.id === selectedId) ?? 'hs';
        return (
          <MarkupShape
            key={item.id}
            item={item}
            image={image}
            className={className}
            label={itemLabel?.(item) ?? null}
            interactive={className.includes('hs-clickable')}
          />
        );
      }),
    [items, image, itemClassName, itemLabel, selectedId],
  );

  const effectiveCursor = panning
    ? 'grabbing'
    : spaceHeld
      ? 'grab'
      : (cursor ?? (view.zoom > 1 && !editable ? 'grab' : 'default'));

  return (
    <div
      ref={viewportRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        background,
        ...style,
        cursor: effectiveCursor,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={clearTooltip}
    >
      {/* Zoom and pan as one CSS transform on a shared wrapper, so the image
          and the SVG never drift apart. */}
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: '0 0' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" draggable={false} style={{ ...FILL, objectFit: 'contain' }} />

        <svg ref={svgRef} viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="xMidYMid meet" style={FILL} onClick={onSvgClick} onKeyDown={onSvgKeyDown}>
          <style>{CANVAS_STYLES}</style>
          {rendered}
          {children}
        </svg>
      </div>

      {/* The cursor label. Always in the DOM — its position is written
          directly by updateTooltip, and state only toggles visibility and text. */}
      <div
        ref={(node) => {
          tooltipRef.current.node = node;
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 20,
          pointerEvents: 'none',
          transformOrigin: 'top left',
          transition: 'opacity 100ms',
          opacity: tooltipLabel ? 1 : 0,
        }}
        aria-hidden={!tooltipLabel}
      >
        <span style={TOOLTIP_STYLE}>{tooltipLabel}</span>
      </div>
    </div>
  );
}

const TOOLTIP_STYLE: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: 12,
  transform: 'translateY(-50%)',
  padding: '4px 8px',
  borderRadius: 6,
  background: 'rgba(23, 23, 23, 0.9)',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.15)',
  color: '#fff',
  font: '500 12px/16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  whiteSpace: 'nowrap',
};

// Hover, selection and colours are CSS, not React state: at 500 polygons, a
// React re-render on every mouse move would not hold up.
//
// A style tag inside `<svg>` applies to the whole document, hence every
// class carrying the `hs-` prefix. Colours here lean on this repo's own ink
// + clay tokens (DESIGN_SYSTEM.md) rather than the reference kit's blue, so
// the editor reads as part of the same product as the rest of `/admin`.
const CANVAS_STYLES = `
  .hs {
    fill: transparent;
    fill-opacity: 0;
    stroke: none;
    pointer-events: all;
    transition: fill-opacity 120ms ease-out;
  }

  .hs-shape {
    fill: var(--hs-color, #9a4e2c);
    stroke: var(--hs-color, #9a4e2c);
    fill-opacity: var(--hs-fill, .25);
  }

  .hs-clickable { cursor: pointer; }
  .hs-draggable { cursor: move; }
  .hs-inert     { pointer-events: none; }

  .hs-clickable:hover,
  .hs-clickable:focus-visible {
    fill-opacity: var(--hs-hover, .45);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .hs-clickable:focus-visible {
    outline: none;
    stroke-width: 3;
    stroke-dasharray: none;
  }

  .hs-idle {
    fill: var(--hs-color, #9a4e2c);
    stroke: var(--hs-color, #9a4e2c);
    fill-opacity: .12;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .hs-selected {
    stroke: #2563eb;
    stroke-width: 2;
    fill-opacity: .3;
    vector-effect: non-scaling-stroke;
  }

  .hs-vertex {
    fill: #ffffff;
    fill-opacity: .5;
    stroke: #2563eb;
    stroke-opacity: .7;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    transition: fill-opacity 90ms, stroke-opacity 90ms;
  }
  .hs-vertex:hover { fill-opacity: 1; stroke-opacity: 1; }

  .hs-edge-handle {
    fill: #2563eb;
    fill-opacity: .4;
    stroke: #ffffff;
    stroke-opacity: .6;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    cursor: pointer;
    transition: fill-opacity 90ms, stroke-opacity 90ms;
  }
  .hs-edge-handle:hover { fill-opacity: 1; stroke-opacity: 1; }

  .hs-draft {
    fill: #2563eb;
    fill-opacity: .2;
    stroke: #2563eb;
    stroke-width: 2;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
`;
