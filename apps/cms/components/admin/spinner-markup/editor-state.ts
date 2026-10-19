/**
 * Editor state: an array of zones + undo/redo stacks. Ported from
 * `svg-editor-kit`'s `client/editor-state.js`, retyped for this repo's zone
 * shape (a polygon plus a target — see `lib/domain/spinner-markup.ts`).
 *
 * History is whole-array snapshots, 50 deep. One mechanism covers every
 * kind of action — creating, moving, editing a vertex, deleting, rebinding a
 * target — so "undo returns the exact previous state" holds by
 * construction, with no need to reason about individual operations.
 *
 * Selection and the in-progress draft are not part of history: undo must
 * not also jump the cursor around the canvas.
 */
import { isEdgeCurved, type EdgeCurve, type Point, type Polygon } from '@/lib/domain/polygon/geometry';
import type { SpinnerZoneTarget } from '@/lib/domain/spinner-markup';

export const HISTORY_LIMIT = 50;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export interface EditorZone {
  id: string;
  polygon: Polygon;
  target: SpinnerZoneTarget | null;
}

export interface EditorState {
  zones: EditorZone[];
  past: EditorZone[][];
  future: EditorZone[][];
  selectedId: string | null;
}

/**
 * Comparison string for autosave: everything that ends up in the database,
 * so a zone whose target changed but whose outline did not still counts as
 * a change. Keys are listed explicitly — `JSON.stringify` depends on key
 * order, and an unlisted key would make a rebind invisible to the diff.
 */
export function serializeZone(zone: EditorZone): string {
  return JSON.stringify({
    points: zone.polygon.points,
    curves: zone.polygon.curves?.length ? zone.polygon.curves : undefined,
    target: zone.target,
  });
}

export function createInitialState(zones: EditorZone[]): EditorState {
  return { zones: structuredClone(zones), past: [], future: [], selectedId: null };
}

/** A snapshot into the past; the future is cleared, as in any ordinary editor. */
function committed(state: EditorState, zones: EditorZone[], selectedId = state.selectedId): EditorState {
  return { zones, past: [...state.past, state.zones].slice(-HISTORY_LIMIT), future: [], selectedId };
}

function patchOne(zones: EditorZone[], id: string, patch: Partial<EditorZone>): EditorZone[] {
  return zones.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function movedPoints(points: Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]): Point => [clamp01(x + dx), clamp01(y + dy)]);
}

/** Moves a polygon. Edge curvature is relative to its chord, so it comes along on its own. */
export function movedPolygon(polygon: Polygon, dx: number, dy: number): Polygon {
  return { ...polygon, points: movedPoints(polygon.points, dx, dy) };
}

/** Inserts a vertex in the middle of side `index`. That side's curvature is reset. */
export function withInsertedVertex(polygon: Polygon, index: number, point: Point): Polygon {
  const points = [...polygon.points];
  points.splice(index + 1, 0, point);

  const curves = [...(polygon.curves ?? [])];
  // One side became two: where its curvature was, there are now two straight ones.
  while (curves.length < polygon.points.length) curves.push(0);
  curves.splice(index, 1, 0, 0);

  return { points, curves };
}

/** Removes vertex `index`, along with the curvature of the sides it separated. */
export function withoutVertex(polygon: Polygon, index: number): Polygon {
  const points = polygon.points.filter((_, i) => i !== index);

  const curves = [...(polygon.curves ?? [])];
  if (curves.length === 0) return { points };

  while (curves.length < polygon.points.length) curves.push(0);
  // Sides index-1 and index merge into one — the new side is straight.
  const previous = (index - 1 + polygon.points.length) % polygon.points.length;
  curves.splice(index, 1);
  curves[Math.min(previous, curves.length - 1)] = 0;

  return { points, curves };
}

export function withCurve(polygon: Polygon, index: number, curve: EdgeCurve): Polygon {
  const curves = [...(polygon.curves ?? [])];
  while (curves.length < polygon.points.length) curves.push(0);
  curves[index] = curve;

  // If nothing is curved any more, drop the field entirely, so the polygon
  // serializes the same way one drawn without curves ever would.
  if (!curves.some(isEdgeCurved)) {
    const { curves: _dropped, ...rest } = polygon;
    return rest;
  }

  return { ...polygon, curves };
}

export type EditorAction =
  | { type: 'select'; id: string | null }
  | { type: 'add'; zone: EditorZone }
  | { type: 'patch'; id: string; patch: Partial<EditorZone> }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; newId: string; dx: number; dy: number }
  | { type: 'gesture-start' }
  | { type: 'gesture-patch'; id: string; patch: Partial<EditorZone> }
  | { type: 'undo' }
  | { type: 'redo' };

export function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };

    case 'add':
      return committed(state, [...state.zones, action.zone], action.zone.id);

    case 'patch':
      return committed(state, patchOne(state.zones, action.id, action.patch));

    case 'remove': {
      const zones = state.zones.filter((item) => item.id !== action.id);
      return committed(state, zones, state.selectedId === action.id ? null : state.selectedId);
    }

    case 'duplicate': {
      const source = state.zones.find((item) => item.id === action.id);
      if (!source) return state;
      const copy: EditorZone = { id: action.newId, polygon: movedPolygon(source.polygon, action.dx, action.dy), target: source.target };
      return committed(state, [...state.zones, copy], copy.id);
    }

    // One gesture (dragging a vertex, a burst of arrow presses): one snapshot
    // at the start, then edits with no history entries of their own. Undo
    // rolls the whole gesture back at once.
    case 'gesture-start':
      return { ...state, past: [...state.past, state.zones].slice(-HISTORY_LIMIT), future: [] };

    case 'gesture-patch':
      return { ...state, zones: patchOne(state.zones, action.id, action.patch) };

    case 'undo': {
      if (state.past.length === 0) return state;
      const zones = state.past[state.past.length - 1]!;
      return {
        zones,
        past: state.past.slice(0, -1),
        future: [state.zones, ...state.future],
        selectedId: zones.some((item) => item.id === state.selectedId) ? state.selectedId : null,
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const zones = state.future[0]!;
      return {
        zones,
        past: [...state.past, state.zones].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selectedId: zones.some((item) => item.id === state.selectedId) ? state.selectedId : null,
      };
    }

    default:
      return state;
  }
}
