/**
 * Pure polygon maths shared by the spinner-markup editor and its read-only
 * viewer. No DOM, no dependencies — ported from the `svg-editor-kit`
 * reference implementation (see its own `geometry/index.js`) with the same
 * behaviour, typed for this repo.
 *
 * Terminology:
 *   polygon — `{ points: [x, y][], curves?: EdgeCurve[] }`, exactly as stored.
 *   point   — a `[x, y]` pair. Normalized (a fraction 0..1) or pixel — the
 *             functions here don't care which, except `toPixels`/`toNormalized`.
 *   curves  — one entry per side: `curves[i]` describes the side from
 *             `points[i]` to `points[i + 1]` (the last side closes the
 *             contour back to `points[0]`). An entry is either a pair
 *             `[along, across]`, a single number (the same as `[0, number]`),
 *             or `0` for a straight side. Shorter than `points` is fine —
 *             the missing sides are read as straight, so a polygon with no
 *             `curves` field at all reads with zero changes.
 */

export type Point = [number, number];
export type EdgeCurve = number | [number, number];
export interface Polygon {
  points: Point[];
  curves?: EdgeCurve[];
}
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

const PRECISION = 1e6; // round to 6 decimal places

/** Pulls the point list out of a polygon. */
export function pointsOf(polygon: Polygon): Point[] {
  return polygon.points;
}

/** Edge curvature. Empty for a polygon with no rounded sides. */
export function curvesOf(polygon: Polygon): EdgeCurve[] {
  return polygon.curves ?? [];
}

/**
 * Normalizes a curve entry to an `[along, across]` pair. A bare number is the
 * old form, where the offset was only across the chord.
 */
export function edgeCurve(value: EdgeCurve | undefined): [number, number] {
  if (Array.isArray(value)) {
    const along = Number.isFinite(value[0]) ? value[0] : 0;
    const across = Number.isFinite(value[1]) ? value[1] : 0;
    return [along, across];
  }
  return [0, Number.isFinite(value) ? (value as number) : 0];
}

export function isEdgeCurved(value: EdgeCurve | undefined): boolean {
  const [along, across] = edgeCurve(value);
  return along !== 0 || across !== 0;
}

export function hasCurves(polygon: Polygon): boolean {
  return curvesOf(polygon).some(isEdgeCurved);
}

/** Compact form: a straight side is `0`, a pure inward/outward bow is a number, otherwise a pair. */
export function packEdgeCurve(along: number, across: number): EdgeCurve {
  if (along === 0 && across === 0) return 0;
  if (along === 0) return across;
  return [along, across];
}

function assertSize(width: number, height: number): void {
  if (!(width > 0) || !(height > 0)) {
    // Width/height are the image's natural pixels. Zero means the image
    // data is broken — this must not fail silently, since every bit of
    // normalization rests on these numbers.
    throw new Error(`Invalid image size: ${width}×${height}`);
  }
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const round6 = (value: number) => Math.round(value * PRECISION) / PRECISION;

/** Normalized coordinates → pixels. */
export function toPixels(polygon: Polygon, width: number, height: number): Point[] {
  assertSize(width, height);
  return pointsOf(polygon).map(([x, y]): Point => [x * width, y * height]);
}

/** Pixels → normalized: rounded to 6 places and clamped to [0, 1]. */
export function toNormalized(points: Point[], width: number, height: number): Point[] {
  assertSize(width, height);
  return points.map(([x, y]): Point => [round6(clamp01(x / width)), round6(clamp01(y / height))]);
}

// ── rounded sides ────────────────────────────────────────────────────────
//
// A side's curvature is the control point's offset from the chord's
// midpoint, stated in the chord's own frame: one fraction along it, one
// across. Both are fractions of the chord's length. The coordinates are
// relative, not absolute, on purpose: moving, duplicating or stretching the
// polygon carries the curve along with it automatically.
//
// The basis is taken in normalized coordinates, not pixels. That makes the
// curve an affine image of the normalized curve, and a quadratic Bézier
// curve is stable under affine transforms — which is exactly why a rounded
// side survives an image swap the same way a straight one does.

/** The quadratic Bézier control point for side a→b. */
export function edgeControlPoint(a: Point, b: Point, curve: EdgeCurve | undefined): Point {
  const [along, across] = edgeCurve(curve);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return [(a[0] + b[0]) / 2 + dx * along - dy * across, (a[1] + b[1]) / 2 + dy * along + dx * across];
}

function quadraticAt(a: Point, control: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * control[0] + t * t * b[0], u * u * a[1] + 2 * u * t * control[1] + t * t * b[1]];
}

/**
 * A side's handle — the point on the curve at t = 0.5, exactly half the
 * control point's offset. Coincides with the chord's midpoint for a
 * straight side.
 */
export function edgeMidpoint(a: Point, b: Point, curve: EdgeCurve | undefined = 0): Point {
  const [along, across] = edgeCurve(curve);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const halfAlong = along / 2;
  const halfAcross = across / 2;
  return [
    (a[0] + b[0]) / 2 + dx * halfAlong - dy * halfAcross,
    (a[1] + b[1]) / 2 + dy * halfAlong + dx * halfAcross,
  ];
}

/**
 * The inverse problem: what curvature puts the side's handle at `point`. The
 * handle follows the cursor freely, both across the chord and along it.
 */
export function curveFromPoint(a: Point, b: Point, point: Point): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return [0, 0];

  const ux = point[0] - (a[0] + b[0]) / 2;
  const uy = point[1] - (a[1] + b[1]) / 2;

  // Decompose the offset onto the chord's basis: (dx, dy) along, (-dy, dx) across.
  // The factor of 2 is because the handle sits at half the control point's offset.
  return [(2 * (ux * dx + uy * dy)) / lengthSquared, (2 * (ux * -dy + uy * dx)) / lengthSquared];
}

/**
 * The polyline outline: rounded sides are flattened into segments. Needed
 * wherever a curve isn't supported directly — chiefly the self-intersection
 * check before saving.
 */
export function flattenPolygon(polygon: Polygon, segments = 12): Point[] {
  const points = pointsOf(polygon);
  if (points.length < 3 || !hasCurves(polygon)) return points;

  const curves = curvesOf(polygon);
  const flat: Point[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const curve = curves[i] ?? 0;

    flat.push(a);
    if (!isEdgeCurved(curve)) continue;

    const control = edgeControlPoint(a, b, curve);
    for (let step = 1; step < segments; step += 1) {
      flat.push(quadraticAt(a, control, b, step / segments));
    }
  }

  return flat;
}

/**
 * The SVG path, in pixels. The one place a polygon becomes markup — both the
 * editor and the read-only viewer draw with this same path.
 */
export function toPathData(polygon: Polygon, width: number, height: number): string {
  assertSize(width, height);

  const points = pointsOf(polygon);
  if (points.length < 2) return '';

  const curves = curvesOf(polygon);
  const at = ([x, y]: Point) => `${(x * width).toFixed(1)},${(y * height).toFixed(1)}`;

  let path = `M ${at(points[0]!)}`;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const curve = curves[i] ?? 0;
    const closing = i === points.length - 1;

    if (isEdgeCurved(curve)) path += ` Q ${at(edgeControlPoint(a, b, curve))} ${at(b)}`;
    // A straight closing side is drawn by Z itself: at hundreds of polygons,
    // one fewer segment per path is real kilobytes of markup saved.
    else if (!closing) path += ` L ${at(b)}`;
  }

  return `${path} Z`;
}

// ── snapping to neighbours ───────────────────────────────────────────────
//
// Neighbouring polygons are left with a one- or two-pixel gap: the outlines
// look aligned to the eye but disagree by coordinate. In the viewer, that gap
// is a hole a click can't land in.
//
// Distances are measured in the source image's own pixels, not normalized
// fractions: x and y have a different scale in fractions, and a tolerance
// stated in fractions would mean a different precision horizontally than
// vertically.

/** The nearest point on segment a→b to point p, and the squared distance to it. */
function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return [a[0] + t * dx, a[1] + t * dy];
}

export interface SnapOptions {
  width: number;
  height: number;
  /** Pixels. */
  tolerance?: number;
}

/**
 * Pulls `polygon`'s vertices toward its neighbours' vertices and sides.
 *
 * A neighbour's vertex outranks its side: two polygons' shared corner should
 * become exactly one point, not two nearby projections.
 *
 * Only on command, never automatically: something already outlined must
 * never move silently.
 */
export function snapPolygonToNeighbours(
  polygon: Polygon,
  neighbours: Polygon[],
  { width, height, tolerance = 6 }: SnapOptions,
): { points: Point[]; snapped: number } {
  assertSize(width, height);

  const points = pointsOf(polygon);
  if (points.length === 0) return { points, snapped: 0 };

  const toleranceSquared = tolerance * tolerance;
  const distanceSquared = (a: Point, b: Point) => {
    const dx = (a[0] - b[0]) * width;
    const dy = (a[1] - b[1]) * height;
    return dx * dx + dy * dy;
  };

  // Neighbours are flattened into polylines: snapping to a rounded wall has to follow its curve.
  const contours = neighbours.map((item) => flattenPolygon(item)).filter((contour) => contour.length >= 2);

  let snapped = 0;

  const result = points.map((point): Point => {
    let best: Point | null = null;
    let bestDistance = toleranceSquared;

    for (const contour of contours) {
      for (const vertex of contour) {
        const distance = distanceSquared(point, vertex);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = vertex;
        }
      }
    }

    if (!best) {
      let bestEdgeDistance = toleranceSquared;
      for (const contour of contours) {
        for (let i = 0; i < contour.length; i += 1) {
          const candidate = nearestOnSegment(point, contour[i]!, contour[(i + 1) % contour.length]!);
          const distance = distanceSquared(point, candidate);
          if (distance < bestEdgeDistance) {
            bestEdgeDistance = distance;
            best = candidate;
          }
        }
      }
    }

    if (!best || (best[0] === point[0] && best[1] === point[1])) return point;

    snapped += 1;
    return [round6(best[0]), round6(best[1])];
  });

  return { points: result, snapped };
}

/**
 * Ray casting: a ray is cast rightward from the point and crossings are
 * counted for parity. Fewer than three points has no area to land in.
 */
export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  const pts = pointsOf(polygon);
  if (pts.length < 3) return false;

  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;

    const straddles = yi > y !== yj > y;
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/** Signed area by the shoelace formula. The sign is the winding direction. */
function signedArea(pts: Point[]): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    sum += pts[j]![0] * pts[i]![1] - pts[i]![0] * pts[j]![1];
  }
  return sum / 2;
}

/** Area by the shoelace formula, always non-negative. */
export function polygonArea(polygon: Polygon): number {
  return Math.abs(signedArea(pointsOf(polygon)));
}

/**
 * The label anchor point. For a normal polygon, the area centroid. For a
 * degenerate one (zero area: duplicate points, collinear points, a bare
 * segment), the centroid formula divides by zero, so the vertex average is
 * returned instead — a label still has to land somewhere.
 */
export function centroid(polygon: Polygon): Point | null {
  const pts = pointsOf(polygon);
  if (pts.length === 0) return null;

  const area = signedArea(pts);

  if (area !== 0) {
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const cross = pts[j]![0] * pts[i]![1] - pts[i]![0] * pts[j]![1];
      cx += (pts[j]![0] + pts[i]![0]) * cross;
      cy += (pts[j]![1] + pts[i]![1]) * cross;
    }
    return [cx / (6 * area), cy / (6 * area)];
  }

  const sum = pts.reduce(([sx, sy], [x, y]): Point => [sx + x, sy + y], [0, 0] as Point);
  return [sum[0] / pts.length, sum[1] / pts.length];
}

export function boundingBox(polygon: Polygon): BoundingBox | null {
  const pts = pointsOf(polygon);
  if (pts.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Cross product (b−a)×(c−a). Sign is the side, zero is collinear. */
function orientation(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * Strict intersection: the segments actually cross. Touching at an endpoint
 * and collinear overlap don't count — deliberately, since duplicate vertices
 * and collinear points produce exactly those touches, and saving must not be
 * blocked because of them.
 */
function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);

  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
}

/**
 * The pre-save check: catches a "bowtie" — a polygon whose sides cross.
 * Fewer than four points can't cross.
 */
export function selfIntersects(polygon: Point[] | Polygon): boolean {
  const pts = Array.isArray(polygon) ? polygon : pointsOf(polygon);
  const n = pts.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i += 1) {
    const a1 = pts[i]!;
    const a2 = pts[(i + 1) % n]!;

    for (let j = i + 1; j < n; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;

      if (segmentsCross(a1, a2, pts[j]!, pts[(j + 1) % n]!)) return true;
    }
  }

  return false;
}
