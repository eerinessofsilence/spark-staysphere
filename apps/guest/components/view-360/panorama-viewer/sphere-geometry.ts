/** A polygon on screen, as `[x, y]` pixel corners in drawing order. */
export type ScreenPolygon = [number, number][];

/** Pannellum positions a hotspot with `translate(Xpx, Ypx)`; this reads that back. */
const TRANSLATE = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/;

/** How far a press may travel and still count as a click rather than a drag, in pixels. */
export const CLICK_SLOP_PX = 6;

/** The `[x, y]` a CSS `transform` translates to, or `null` when it names none. */
export function readTranslate(transform: string): [number, number] | null {
  const match = TRANSLATE.exec(transform);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** Ray casting: is the point inside the polygon? Standard even–odd rule. */
export function pointInPolygon(polygon: ScreenPolygon, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The id of the first polygon containing the point, or `null`. */
export function hitTest(polygons: Record<string, ScreenPolygon>, x: number, y: number): string | null {
  for (const [id, polygon] of Object.entries(polygons)) {
    if (pointInPolygon(polygon, x, y)) return id;
  }
  return null;
}

/** Whether a press from `start` to `end` stayed put — a drag ends in a click too, and must not select. */
export function isClick(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= CLICK_SLOP_PX;
}
