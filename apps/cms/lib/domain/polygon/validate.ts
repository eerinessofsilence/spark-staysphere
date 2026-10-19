/**
 * Checks what comes in from the spinner-markup editor before it is written
 * to storage. Same rules the editor itself enforces client-side — but
 * mandatory here: the client can be bypassed, the database cannot. Ported
 * from `svg-editor-kit`'s `server/validate.js`.
 */
import { flattenPolygon, selfIntersects, type EdgeCurve, type Point, type Polygon } from './geometry';

export const MAX_POINTS = 500;
/** Curvature — fractions of the chord's length. Past four is a loop, not a wall. */
export const MAX_CURVE = 4;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new Error(`Invalid id in field "${field}"`);
  }
  return value;
}

/**
 * Checks one polygon and returns it in canonical form: `{ points }` or
 * `{ points, curves }` — `curves` only when it was given and isn't empty.
 */
export function checkPolygon(polygon: unknown, index?: number): Polygon {
  const where = index === undefined ? 'Polygon' : `Polygon #${index + 1}`;
  const points = (polygon as { points?: unknown } | null | undefined)?.points;

  if (!Array.isArray(points)) throw new Error(`${where}: no point list`);
  if (points.length < 3) throw new Error(`${where}: fewer than three points`);
  if (points.length > MAX_POINTS) throw new Error(`${where}: more than ${MAX_POINTS} points`);

  for (const point of points as unknown[]) {
    if (!Array.isArray(point) || point.length !== 2) throw new Error(`${where}: a point is not a pair of numbers`);
    const [x, y] = point as [unknown, unknown];
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
      throw new Error(`${where}: a coordinate is not a number`);
    }
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      throw new Error(`${where}: a coordinate is outside 0..1 — these aren't normalized coordinates`);
    }
  }

  // Edge curvature is optional; its absence means a straight contour.
  const curves = (polygon as { curves?: unknown } | null | undefined)?.curves;
  if (curves !== undefined && curves !== null) {
    if (!Array.isArray(curves)) throw new Error(`${where}: curvature must be a list`);
    if (curves.length > points.length) throw new Error(`${where}: more curves than sides`);

    for (const value of curves as unknown[]) {
      // An entry is either an [along, across] pair or a single number (across only).
      const pair = Array.isArray(value) ? value : [0, value];
      if (pair.length !== 2) throw new Error(`${where}: a side's curvature is not a pair of numbers`);
      for (const component of pair) {
        if (typeof component !== 'number' || !Number.isFinite(component)) {
          throw new Error(`${where}: a side's curvature is not a number`);
        }
        if (Math.abs(component) > MAX_CURVE) throw new Error(`${where}: a side is bowed implausibly far`);
      }
    }
  }

  const normalized: Polygon = (curves as unknown[] | undefined)?.length
    ? { points: points as Point[], curves: curves as EdgeCurve[] }
    : { points: points as Point[] };

  // Checked against the flattened contour: bowed sides can overlap where the
  // vertex-to-vertex polyline doesn't cross yet.
  if (selfIntersects(flattenPolygon(normalized))) {
    throw new Error(`${where}: sides cross themselves`);
  }

  return normalized;
}

export interface SaveBatchRow {
  id: string;
  polygon: Polygon;
}

export interface ParsedSaveBatch {
  rows: SaveBatchRow[];
  deletes: string[];
}

/**
 * Parses the autosave batch the editor sends:
 *   `{ upserts: [{ id, polygon }], deletes: [id] }`
 * Returns `{ rows: [{ id, polygon }], deletes: [id] }` — everything checked
 * and normalized. Extra fields on an item are dropped.
 */
export function parseSaveBatch(batch: unknown): ParsedSaveBatch {
  const input = (batch ?? {}) as { upserts?: unknown; deletes?: unknown };
  const upserts = input.upserts ?? [];
  const deletes = input.deletes ?? [];

  if (!Array.isArray(upserts)) throw new Error('upserts must be a list');
  if (!Array.isArray(deletes)) throw new Error('deletes must be a list');

  const rows = upserts.map((item, index) => {
    const entry = item as { id?: unknown; polygon?: unknown } | null | undefined;
    return {
      id: requireUuid(entry?.id, `polygon #${index + 1}`),
      polygon: checkPolygon(entry?.polygon, index),
    };
  });

  return { rows, deletes: deletes.map((value) => requireUuid(value, 'polygon')) };
}

export interface SaveFailure {
  ok: false;
  error: string;
}

/** An error, shaped the way the editor understands as a failed save. */
export function failure(error: unknown): SaveFailure {
  return { ok: false, error: (error as { message?: string } | undefined)?.message ?? 'Unknown error' };
}
