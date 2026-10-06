import type { PannellumHotSpot } from './pannellum';
import type { PanoramaHotSpot, PanoramaOutline } from './types';

/** Class names are written out in full here so Tailwind emits them. */
const MARKER_CLASS =
  'pnlm-marker glass flex items-center gap-2 rounded-full py-2 pr-3.5 pl-3 text-sm font-medium whitespace-nowrap text-foreground shadow-soft';

/** The key a corner element is registered under: `<outline id>:<corner index>`. */
export function cornerKey(outlineId: string, index: number): string {
  return `${outlineId}:${index}`;
}

/**
 * A marker Pannellum positions every frame, filled with the product's pill:
 * an accent dot, the label, and an optional quieter second line. Pannellum
 * builds the element; `onMount` hands it back so its on-screen position can
 * anchor a card.
 */
export function markerHotSpot(
  spot: PanoramaHotSpot,
  onMount: (element: HTMLElement) => void,
  onClick: () => void,
): PannellumHotSpot {
  return {
    id: spot.id,
    yaw: spot.yaw,
    pitch: spot.pitch,
    cssClass: MARKER_CLASS,
    createTooltipArgs: { label: spot.label, detail: spot.detail },
    createTooltipFunc: (element: HTMLElement, text: { label: string; detail?: string | null }) => {
      onMount(element);
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
    clickHandlerFunc: onClick,
  };
}

/**
 * An outline is drawn from invisible corner hotspots: Pannellum projects each
 * corner onto the screen every frame, and `trackProjectedShapes` reads the
 * projected positions back into an SVG. Nothing here re-implements the
 * projection maths.
 */
export function cornerHotSpots(
  outline: PanoramaOutline,
  onMount: (key: string, element: HTMLElement) => void,
): PannellumHotSpot[] {
  return outline.points.map((point, index) => ({
    id: `corner:${cornerKey(outline.id, index)}`,
    yaw: point.yaw,
    pitch: point.pitch,
    cssClass: 'pnlm-vertex',
    createTooltipArgs: cornerKey(outline.id, index),
    createTooltipFunc: (element: HTMLElement, key: string) => onMount(key, element),
  }));
}
