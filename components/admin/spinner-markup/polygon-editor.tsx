'use client';

import * as React from 'react';
import {
  curveFromPoint,
  curvesOf,
  edgeMidpoint,
  flattenPolygon,
  isEdgeCurved,
  packEdgeCurve,
  selfIntersects,
  snapPolygonToNeighbours,
  type Point,
} from '@/lib/domain/polygon/geometry';
import type { SpinnerZoneTarget } from '@/lib/domain/spinner-markup';
import { MarkupCanvas, screenToNormalized, type ImageSize } from './markup-canvas';
import {
  createInitialState,
  movedPolygon,
  reducer,
  serializeZone,
  withCurve,
  withInsertedVertex,
  withoutVertex,
  type EditorZone,
} from './editor-state';
import { IconMagnet, IconPencil, IconPointer, IconRedo, IconSquare, IconUndo } from './icons';
import { ShortcutsPanel } from './shortcuts-panel';
import { EDITOR_STYLES } from './styles';
import { ZoneList } from './zone-list';
import { ZoneTargetEditor, type SpinnerMarkupCatalog } from './zone-target-editor';

// The polygon editor over an image. The canvas centred, shortcuts on the
// left, the zone list (and its target editor) on the right.
//
// Every edit is local state. Autosave, if `onSave` is passed, carries it to
// the database: 2 seconds after the last edit, one batch
// `{ upserts, deletes }` for every change at once.
//
// Keyboard shortcuts work only while focus is inside the editor: embedded in
// a page, it must not steal that page's arrows, Delete or space bar.
//
// Ported from `svg-editor-kit`'s `client/polygon-editor.jsx`, retyped for
// this repo's zones (a polygon plus a `SpinnerZoneTarget`) — see
// `ZoneTargetEditor` for the one piece that is specific to this catalog
// rather than the reusable kit.

const AUTOSAVE_DELAY = 2000;
const NUDGE_GESTURE_GAP = 600; // a burst of arrow presses faster than this is one history step
const SNAP_TOLERANCE_PX = 8; // the magnet's radius, in the source image's own pixels
const NOTICE_TIMEOUT = 5000;

// The handle on screen: 9px unmagnified, ~4.5px at four times zoom. It
// shrinks as you zoom in — aiming at a vertex gets more precise, not less.
const HANDLE_PX_AT_1X = 9;
const handleScreenPx = (zoom: number) => HANDLE_PX_AT_1X / (1 + (zoom - 1) * 0.33);

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

const TOOLS = [
  { id: 'select', label: 'Select', key: 'V', Icon: IconPointer },
  { id: 'polygon', label: 'Polygon', key: 'P', Icon: IconPencil },
  { id: 'rect', label: 'Rectangle', key: 'R', Icon: IconSquare },
] as const;

type Tool = (typeof TOOLS)[number]['id'];

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: 'Saved',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  error: 'Save failed',
};

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

interface Notice {
  variant: 'error' | 'info';
  title: string;
  description?: string;
}

function isTypingTarget(target: HTMLElement): boolean {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

export interface SaveBatch {
  upserts: Array<{ id: string; polygon: EditorZone['polygon']; target: SpinnerZoneTarget | null }>;
  deletes: string[];
}

export type SaveResult = { ok: true } | { ok: false; error?: string };

export interface PolygonEditorHandle {
  /** Save now, without waiting for the timer. `true` means everything is written and error-free. */
  flush: () => Promise<boolean>;
  getZones: () => EditorZone[];
  isSaved: () => boolean;
  select: (id: string | null) => void;
}

export interface PolygonEditorProps {
  image: ImageSize;
  /** `[{ id, polygon, target }]`; read once on mount. Pass a different `key` for a different frame. */
  initialZones?: EditorZone[];
  /** Every physical room and room type a zone can point to. */
  catalog: SpinnerMarkupCatalog;
  onSave?: (batch: SaveBatch) => Promise<SaveResult>;
  onChange?: (zones: EditorZone[]) => void;
  onSelectionChange?: (id: string | null) => void;
  onNotify?: (notice: Notice) => void;
  /** A zone's label in the list and in messages — usually what its target resolves to. */
  zoneLabel?: (zone: EditorZone) => string | null;
  autosaveDelay?: number;
  showShortcuts?: boolean;
  showList?: boolean;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const PolygonEditor = React.forwardRef<PolygonEditorHandle, PolygonEditorProps>(function PolygonEditor(
  {
    image,
    initialZones = [],
    catalog,
    onSave,
    onChange,
    onSelectionChange,
    onNotify,
    zoneLabel,
    autosaveDelay = AUTOSAVE_DELAY,
    showShortcuts = true,
    showList = true,
    toolbarStart = null,
    toolbarEnd = null,
    className = '',
    style,
  },
  ref,
) {
  const [state, dispatch] = React.useReducer(reducer, initialZones, createInitialState);
  const [tool, setTool] = React.useState<Tool>('select');
  const [draft, setDraft] = React.useState<{ points: Point[]; cursor: Point } | null>(null); // the P tool
  const [rectDraft, setRectDraft] = React.useState<{ start: Point; current: Point; pointerId: number } | null>(null); // the R tool
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('saved');
  const [notice, setNotice] = React.useState<Notice | null>(null);

  const svgRef = React.useRef<SVGSVGElement>(null);
  // The draft is mirrored into a ref: handlers read it synchronously, without
  // going through the state updaters StrictMode runs twice.
  const draftRef = React.useRef<{ points: Point[]; cursor: Point } | null>(null);
  const vertexDragRef = React.useRef<{ kind: 'body' | 'vertex' | 'edge'; hotspotId: string; index?: number; last?: Point; started: boolean } | null>(null);
  const nudgeAtRef = React.useRef(0);
  const savedRef = React.useRef(new Map(initialZones.map((z) => [z.id, serializeZone(z)])));
  const warnedInvalidRef = React.useRef('');

  const { zones, selectedId } = state;
  const selected = zones.find((item) => item.id === selectedId) ?? null;
  const autosave = Boolean(onSave);

  const stateRef = React.useRef(state);
  stateRef.current = state;
  const saveStatusRef = React.useRef(saveStatus);
  saveStatusRef.current = saveStatus;

  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;
  const onNotifyRef = React.useRef(onNotify);
  onNotifyRef.current = onNotify;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const zoneLabelRef = React.useRef(zoneLabel);
  zoneLabelRef.current = zoneLabel;

  // ── messages ──────────────────────────────────────────────────────────────

  const notify = React.useCallback((message: Notice) => {
    if (onNotifyRef.current) onNotifyRef.current(message);
    else setNotice(message);
  }, []);

  React.useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT);
    return () => clearTimeout(timer);
  }, [notice]);

  const reportedZonesRef = React.useRef(zones);
  React.useEffect(() => {
    if (reportedZonesRef.current === zones) return;
    reportedZonesRef.current = zones;
    onChangeRef.current?.(zones);
  }, [zones]);

  const reportedSelectionRef = React.useRef(selectedId);
  React.useEffect(() => {
    if (reportedSelectionRef.current === selectedId) return;
    reportedSelectionRef.current = selectedId;
    onSelectionChangeRef.current?.(selectedId);
  }, [selectedId]);

  // ── coordinates ───────────────────────────────────────────────────────────

  const [unitsPerPixel, setUnitsPerPixel] = React.useState(1);
  const [zoom, setZoom] = React.useState(1);

  const onViewChange = React.useCallback(({ zoom: nextZoom, svg }: { zoom: number; svg: SVGSVGElement | null }) => {
    setZoom(nextZoom);
    const ctm = svg?.getScreenCTM();
    if (ctm) {
      const scale = Math.hypot(ctm.a, ctm.b);
      if (scale > 0) setUnitsPerPixel(1 / scale);
    }
  }, []);

  const normFromEvent = React.useCallback(
    (event: { clientX: number; clientY: number }): Point | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = screenToNormalized(svg, event.clientX, event.clientY, image);
      return point ? [clamp01(point[0]), clamp01(point[1])] : null;
    },
    [image],
  );

  /** The "click on the first vertex closes the contour" threshold — roughly 8 screen pixels. */
  const closeThreshold = React.useCallback(() => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
    return 8 / scale / Math.min(image.width, image.height);
  }, [image]);

  // ── autosave ──────────────────────────────────────────────────────────────

  const computeDiff = React.useCallback(() => {
    const current = stateRef.current.zones;
    const currentIds = new Set(current.map((z) => z.id));
    const upserts: SaveBatch['upserts'] = [];
    const invalid: string[] = [];

    for (const [index, zone] of current.entries()) {
      if (savedRef.current.get(zone.id) === serializeZone(zone)) continue;

      const name = nameOf(zone, index);
      if (zone.polygon.points.length < 3) {
        invalid.push(`"${name}": fewer than three points`);
      } else if (selfIntersects(flattenPolygon(zone.polygon))) {
        invalid.push(`"${name}": sides cross themselves`);
      } else {
        upserts.push({ id: zone.id, polygon: zone.polygon, target: zone.target });
      }
    }

    const deletes = [...savedRef.current.keys()].filter((id) => !currentIds.has(id));
    return { upserts, deletes, invalid };
  }, []);

  function nameOf(zone: EditorZone, index: number): string {
    return zoneLabelRef.current?.(zone) || `Zone ${index + 1}`;
  }

  const flush = React.useCallback(async () => {
    const save = onSaveRef.current;
    if (!save) return true;

    const { upserts, deletes, invalid } = computeDiff();

    const invalidKey = invalid.join('|');
    if (invalid.length > 0 && warnedInvalidRef.current !== invalidKey) {
      warnedInvalidRef.current = invalidKey;
      notify({ variant: 'error', title: 'Zone not saved', description: invalid.join('. ') });
    }
    if (invalid.length === 0) warnedInvalidRef.current = '';

    if (upserts.length === 0 && deletes.length === 0) {
      setSaveStatus(invalid.length > 0 ? 'error' : 'saved');
      return invalid.length === 0;
    }

    setSaveStatus('saving');

    let error: string | null = null;
    try {
      const result = await save({ upserts, deletes });
      if (result && result.ok === false) error = result.error ?? 'Unknown error';
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : 'Unknown error';
    }

    if (error) {
      setSaveStatus('error');
      notify({ variant: 'error', title: 'Autosave failed', description: error });
      return false;
    }

    for (const item of upserts) {
      const live = stateRef.current.zones.find((z) => z.id === item.id);
      // The zone might have moved again between the request and its
      // response — the next cycle will pick that up; here we record only
      // what was actually written.
      savedRef.current.set(item.id, serializeZone({ id: item.id, polygon: item.polygon, target: item.target }));
      if (live && serializeZone(live) !== serializeZone({ id: item.id, polygon: item.polygon, target: item.target })) {
        setSaveStatus('pending');
      }
    }
    for (const id of deletes) savedRef.current.delete(id);

    setSaveStatus((current) => (current === 'saving' ? (invalid.length > 0 ? 'error' : 'saved') : current));
    return invalid.length === 0;
  }, [computeDiff, notify]);

  const flushRef = React.useRef(flush);
  flushRef.current = flush;

  React.useEffect(() => {
    if (!autosave) return undefined;

    const { upserts, deletes, invalid } = computeDiff();
    if (upserts.length === 0 && deletes.length === 0 && invalid.length === 0) return undefined;

    setSaveStatus('pending');
    const timer = setTimeout(() => flushRef.current(), autosaveDelay);
    return () => clearTimeout(timer);
  }, [zones, computeDiff, autosave, autosaveDelay]);

  React.useEffect(() => {
    if (!autosave) return undefined;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (saveStatusRef.current === 'saved') return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [autosave]);

  React.useImperativeHandle(
    ref,
    () => ({
      flush: () => flushRef.current(),
      getZones: () => stateRef.current.zones,
      isSaved: () => saveStatusRef.current === 'saved',
      select: (id: string | null) => dispatch({ type: 'select', id }),
    }),
    [],
  );

  // ── operations ────────────────────────────────────────────────────────────

  const addPolygon = React.useCallback(
    (points: Point[]) => {
      if (selfIntersects(points)) {
        notify({ variant: 'error', title: 'Zone not created', description: 'The sides cross themselves.' });
        return;
      }
      dispatch({ type: 'add', zone: { id: crypto.randomUUID(), polygon: { points }, target: null } });
    },
    [notify],
  );

  /**
   * Closes the draft contour. `addPolygon` cannot be called INSIDE `setDraft`'s
   * updater: StrictMode runs a dev-mode updater twice, which would create two
   * zones per Enter. The updater has to be pure, so the draft is read from a
   * ref, and creating the zone happens outside it.
   */
  const closeDraft = React.useCallback(() => {
    const current = draftRef.current;
    if (!current) return;

    draftRef.current = null;
    setDraft(null);

    if (current.points.length >= 3) addPolygon(current.points);
    else notify({ variant: 'error', title: 'Zone not created', description: 'At least three points are needed.' });
  }, [addPolygon, notify]);

  const duplicateSelected = React.useCallback(() => {
    const id = stateRef.current.selectedId;
    if (!id) return;
    dispatch({ type: 'duplicate', id, newId: crypto.randomUUID(), dx: 10 / image.width, dy: 10 / image.height });
  }, [image]);

  const nudgeSelected = React.useCallback((dx: number, dy: number) => {
    const current = stateRef.current;
    const target = current.zones.find((z) => z.id === current.selectedId);
    if (!target) return;

    const now = Date.now();
    if (now - nudgeAtRef.current > NUDGE_GESTURE_GAP) dispatch({ type: 'gesture-start' });
    nudgeAtRef.current = now;

    dispatch({ type: 'gesture-patch', id: target.id, patch: { polygon: movedPolygon(target.polygon, dx, dy) } });
  }, []);

  const deleteVertex = React.useCallback(
    (zone: EditorZone, index: number) => {
      if (zone.polygon.points.length <= 3) {
        notify({
          variant: 'error',
          title: 'Vertex not deleted',
          description: 'A polygon needs at least three points left. Delete the whole zone instead.',
        });
        return;
      }
      dispatch({ type: 'patch', id: zone.id, patch: { polygon: withoutVertex(zone.polygon, index) } });
    },
    [notify],
  );

  const insertVertex = React.useCallback((zone: EditorZone, edgeIndex: number, point: Point) => {
    dispatch({ type: 'patch', id: zone.id, patch: { polygon: withInsertedVertex(zone.polygon, edgeIndex, point) } });
  }, []);

  /**
   * The magnet: the selected polygon's vertices are pulled to its
   * neighbours' vertices and sides. Fixes one- or two-pixel gaps between
   * neighbouring polygons — aligned to the eye, mismatched by coordinate.
   *
   * Only on command, never on its own: something already outlined must
   * never move silently.
   */
  const snapSelected = React.useCallback(() => {
    const current = stateRef.current;
    const target = current.zones.find((item) => item.id === current.selectedId);
    if (!target) return;

    const neighbours = current.zones.filter((item) => item.id !== target.id).map((item) => item.polygon);

    const { points, snapped } = snapPolygonToNeighbours(target.polygon, neighbours, {
      width: image.width,
      height: image.height,
      tolerance: SNAP_TOLERANCE_PX,
    });

    if (snapped === 0) {
      notify({ variant: 'info', title: 'Nothing to snap to', description: `No other vertex or side within ${SNAP_TOLERANCE_PX} px.` });
      return;
    }

    dispatch({ type: 'patch', id: target.id, patch: { polygon: { ...target.polygon, points } } });
    notify({ variant: 'info', title: `Snapped ${snapped} vert${snapped === 1 ? 'ex' : 'ices'}` });
  }, [image, notify]);

  const straightenEdge = React.useCallback((zone: EditorZone, edgeIndex: number) => {
    dispatch({ type: 'patch', id: zone.id, patch: { polygon: withCurve(zone.polygon, edgeIndex, 0) } });
  }, []);

  // ── keyboard ──────────────────────────────────────────────────────────────
  //
  // The handler sits on the editor's root, not on `window`: keys only reach
  // here while focus is inside. The root is focusable (tabIndex=-1), so a
  // click on the canvas moves focus into the editor by itself.

  function onKeyDown(event: React.KeyboardEvent) {
    if (isTypingTarget(event.target as HTMLElement)) return;

    // `event.code` everywhere, not `event.key`: the code is the physical
    // key, independent of layout. On a non-Latin layout, `event.key` for
    // Ctrl+D is not "d", the check misses, `preventDefault` is skipped, and
    // the browser opens its bookmark dialog instead of duplicating the zone.
    if (event.ctrlKey || event.metaKey) {
      if (event.code === 'KeyZ') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (event.code === 'KeyD') {
        event.preventDefault();
        duplicateSelected();
      }
      return;
    }

    switch (event.code) {
      case 'KeyV':
        setTool('select');
        break;
      case 'KeyP':
        setTool('polygon');
        break;
      case 'KeyR':
        setTool('rect');
        break;
      case 'KeyM':
        snapSelected();
        break;
      case 'Enter':
      case 'NumpadEnter':
        closeDraft();
        break;
      case 'Escape':
        draftRef.current = null;
        setDraft(null);
        setRectDraft(null);
        dispatch({ type: 'select', id: null });
        break;
      case 'Delete':
      case 'Backspace':
        if (stateRef.current.selectedId) {
          event.preventDefault();
          dispatch({ type: 'remove', id: stateRef.current.selectedId });
        }
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (!stateRef.current.selectedId) break;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = (event.code === 'ArrowLeft' ? -step : event.code === 'ArrowRight' ? step : 0) / image.width;
        const dy = (event.code === 'ArrowUp' ? -step : event.code === 'ArrowDown' ? step : 0) / image.height;
        nudgeSelected(dx, dy);
        break;
      }
      default:
    }
  }

  // ── mouse on the canvas ───────────────────────────────────────────────────

  function onBackgroundPointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    const point = normFromEvent(event);
    if (!point) return;

    if (tool === 'polygon') {
      const current = draftRef.current;

      if (!current) {
        const next = { points: [point], cursor: point };
        draftRef.current = next;
        setDraft(next);
        return;
      }

      const [firstX, firstY] = current.points[0]!;
      if (current.points.length >= 3 && Math.hypot(point[0] - firstX, point[1] - firstY) < closeThreshold()) {
        closeDraft();
        return;
      }

      const next = { ...current, points: [...current.points, point], cursor: point };
      draftRef.current = next;
      setDraft(next);
      return;
    }

    if (tool === 'rect') {
      setRectDraft({ start: point, current: point, pointerId: event.pointerId });
      return;
    }

    // A press inside a polygon is a bid to drag it whole. Vertex and edge
    // handles catch the event first (stopPropagation), so only a press on
    // the fill itself reaches here.
    const node = (event.target as HTMLElement).closest?.('[data-hotspot-id]') as HTMLElement | null;
    if (node) {
      const zone = stateRef.current.zones.find((item) => item.id === node.dataset.hotspotId);
      if (zone) {
        dispatch({ type: 'select', id: zone.id });
        // The drag itself only starts if the cursor actually moves — otherwise
        // a plain click on a polygon would become an empty history step.
        vertexDragRef.current = { kind: 'body', hotspotId: zone.id, last: point, started: false };
      }
      return;
    }

    // A click past every polygon and vertex clears the selection.
    if (!(event.target as HTMLElement).closest?.('[data-vertex]')) {
      dispatch({ type: 'select', id: null });
    }
  }

  function onPointerMoveCanvas(event: React.PointerEvent) {
    const drag = vertexDragRef.current;

    if (drag) {
      const point = normFromEvent(event);
      if (!point) return;
      const target = stateRef.current.zones.find((z) => z.id === drag.hotspotId);
      if (!target) return;

      // A history snapshot on the first real movement, not on press: a click
      // on a handle with no drag would otherwise leave an empty undo step.
      if (!drag.started) {
        drag.started = true;
        dispatch({ type: 'gesture-start' });
      }

      if (drag.kind === 'body') {
        dispatch({
          type: 'gesture-patch',
          id: drag.hotspotId,
          patch: { polygon: movedPolygon(target.polygon, point[0] - drag.last![0], point[1] - drag.last![1]) },
        });
        drag.last = point;
        return;
      }

      if (drag.kind === 'vertex') {
        const points = target.polygon.points.map((p, i): Point => (i === drag.index ? point : p));
        dispatch({ type: 'gesture-patch', id: drag.hotspotId, patch: { polygon: { ...target.polygon, points } } });
        return;
      }

      // The edge handle follows the cursor freely: across the chord (bow)
      // and along it (an asymmetric arc). Both fractions pack into `curves[index]`.
      const points = target.polygon.points;
      const a = points[drag.index!]!;
      const b = points[(drag.index! + 1) % points.length]!;
      const [along, across] = curveFromPoint(a, b, point);

      dispatch({
        type: 'gesture-patch',
        id: drag.hotspotId,
        patch: { polygon: withCurve(target.polygon, drag.index!, packEdgeCurve(along, across)) },
      });
      return;
    }

    if (draft) {
      const point = normFromEvent(event);
      if (point && draftRef.current) {
        const next = { ...draftRef.current, cursor: point };
        draftRef.current = next;
        setDraft(next);
      }
      return;
    }

    if (rectDraft) {
      const point = normFromEvent(event);
      if (point) setRectDraft((current) => (current ? { ...current, current: point } : current));
    }
  }

  function onPointerUpCanvas() {
    if (vertexDragRef.current) {
      vertexDragRef.current = null;
      return;
    }

    if (rectDraft) {
      const { start, current } = rectDraft;
      setRectDraft(null);
      const minSide = 4 / Math.min(image.width, image.height);
      if (Math.abs(current[0] - start[0]) > minSide && Math.abs(current[1] - start[1]) > minSide) {
        addPolygon([
          [start[0], start[1]],
          [current[0], start[1]],
          [current[0], current[1]],
          [start[0], current[1]],
        ]);
      }
    }
  }

  function onZoneClick(zone: EditorZone) {
    if (tool !== 'select') return;
    dispatch({ type: 'select', id: zone.id });
  }

  function onVertexPointerDown(event: React.PointerEvent, zone: EditorZone, index: number) {
    event.stopPropagation();
    if (event.button !== 0) return;

    if (event.altKey) {
      deleteVertex(zone, index);
      return;
    }

    vertexDragRef.current = { kind: 'vertex', hotspotId: zone.id, index, started: false };
  }

  function onEdgeHandlePointerDown(event: React.PointerEvent, zone: EditorZone, index: number, point: Point) {
    event.stopPropagation();
    if (event.button !== 0) return;

    if (event.altKey) {
      insertVertex(zone, index, point);
      return;
    }

    vertexDragRef.current = { kind: 'edge', hotspotId: zone.id, index, started: false };
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  const zoneClassName = React.useCallback(
    (zone: EditorZone, isSelected: boolean) => {
      const draggable = tool === 'select' ? ' hs-draggable' : '';
      return `hs ${isSelected ? 'hs-selected' : 'hs-idle'} hs-clickable${draggable}`;
    },
    [tool],
  );

  // Docked in the sidebar, above the target editor, rather than over the
  // canvas: the draw tools act on the selected zone shown right below them.
  const sidebarToolbar = (
    <div className="pe-side-toolbar">
      <div className="pe-group" role="group" aria-label="Tools">
        {TOOLS.map(({ id, label, key, Icon }) => (
          <button
            key={id}
            type="button"
            className="pe-btn"
            data-active={tool === id || undefined}
            aria-pressed={tool === id}
            aria-label={`${label} (${key})`}
            title={`${label} — ${key}`}
            onClick={() => setTool(id)}
          >
            <Icon className="pe-icon" />
          </button>
        ))}
      </div>

      <button
        type="button"
        className="pe-btn"
        aria-label="Snap to neighbours (M)"
        title="Snap to neighbours — M. Closes gaps between neighbouring zones"
        disabled={!selected}
        onClick={snapSelected}
      >
        <IconMagnet className="pe-icon" />
      </button>

      <button
        type="button"
        className="pe-btn"
        aria-label="Undo (Ctrl+Z)"
        title="Undo — Ctrl+Z"
        disabled={state.past.length === 0}
        onClick={() => dispatch({ type: 'undo' })}
      >
        <IconUndo className="pe-icon" />
      </button>
      <button
        type="button"
        className="pe-btn"
        aria-label="Redo (Ctrl+Shift+Z)"
        title="Redo — Ctrl+Shift+Z"
        disabled={state.future.length === 0}
        onClick={() => dispatch({ type: 'redo' })}
      >
        <IconRedo className="pe-icon" />
      </button>
    </div>
  );

  const vertexSize = handleScreenPx(zoom) * unitsPerPixel;

  const px = ([x, y]: Point) => `${x * image.width},${y * image.height}`;

  const edgeHandles = selected
    ? selected.polygon.points.map((a, index) => {
        const points = selected.polygon.points;
        const b = points[(index + 1) % points.length]!;
        const curve = curvesOf(selected.polygon)[index] ?? 0;
        return { index, curved: isEdgeCurved(curve), at: edgeMidpoint(a, b, curve) };
      })
    : [];

  const editorChildren = (
    <>
      {selected ? (
        <g>
          {edgeHandles.map((handle) => (
            <circle
              key={`edge-${handle.index}`}
              data-vertex
              cx={handle.at[0] * image.width}
              cy={handle.at[1] * image.height}
              r={vertexSize * 0.45}
              className="hs-edge-handle"
              onPointerDown={(event) => onEdgeHandlePointerDown(event, selected, handle.index, handle.at)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (handle.curved) straightenEdge(selected, handle.index);
              }}
            />
          ))}

          {selected.polygon.points.map((point, index) => (
            <rect
              key={index}
              data-vertex
              x={point[0] * image.width - vertexSize / 2}
              y={point[1] * image.height - vertexSize / 2}
              width={vertexSize}
              height={vertexSize}
              className="hs-vertex"
              style={{ cursor: 'move' }}
              onPointerDown={(event) => onVertexPointerDown(event, selected, index)}
            />
          ))}
        </g>
      ) : null}

      {draft ? (
        <g>
          <polyline points={[...draft.points, draft.cursor].map(px).join(' ')} className="hs-draft" fill="none" />
          {draft.points.length >= 3 ? (
            <line
              x1={draft.cursor[0] * image.width}
              y1={draft.cursor[1] * image.height}
              x2={draft.points[0]![0] * image.width}
              y2={draft.points[0]![1] * image.height}
              className="hs-draft"
            />
          ) : null}
          <rect
            x={draft.points[0]![0] * image.width - vertexSize / 2}
            y={draft.points[0]![1] * image.height - vertexSize / 2}
            width={vertexSize}
            height={vertexSize}
            className="hs-vertex"
          />
        </g>
      ) : null}

      {rectDraft ? (
        <rect
          x={Math.min(rectDraft.start[0], rectDraft.current[0]) * image.width}
          y={Math.min(rectDraft.start[1], rectDraft.current[1]) * image.height}
          width={Math.abs(rectDraft.current[0] - rectDraft.start[0]) * image.width}
          height={Math.abs(rectDraft.current[1] - rectDraft.start[1]) * image.height}
          className="hs-draft"
        />
      ) : null}
    </>
  );

  return (
    <div data-pe-root tabIndex={-1} className={`pe-root ${className}`} style={style} onKeyDown={onKeyDown}>
      <style>{EDITOR_STYLES}</style>

      <header className="pe-toolbar">
        {toolbarStart}

        <div className="pe-toolbar-end">
          {notice ? (
            <span className="pe-notice" data-variant={notice.variant} role="status" title={notice.description}>
              {notice.title}
              {notice.description ? `: ${notice.description}` : ''}
            </span>
          ) : null}

          {autosave ? <span className="pe-save" data-error={saveStatus === 'error' || undefined}>{SAVE_LABELS[saveStatus]}</span> : null}
          {autosave && saveStatus === 'error' ? (
            <button type="button" className="pe-btn pe-btn-outline" onClick={() => flushRef.current()}>
              Retry
            </button>
          ) : null}

          {toolbarEnd}
        </div>
      </header>

      <div className="pe-body">
        {showShortcuts ? <ShortcutsPanel /> : null}

        <MarkupCanvas
          editable
          image={image}
          items={zones}
          selectedId={selectedId}
          svgRef={svgRef}
          itemClassName={zoneClassName}
          onItemClick={onZoneClick}
          onBackgroundPointerDown={onBackgroundPointerDown}
          onPointerMoveCanvas={onPointerMoveCanvas}
          onPointerUpCanvas={onPointerUpCanvas}
          onViewChange={onViewChange}
          cursor={tool === 'select' ? undefined : 'crosshair'}
          className="pe-canvas"
        >
          {editorChildren}
        </MarkupCanvas>

        {showList ? (
          <ZoneList zones={zones} selected={selected} dispatch={dispatch} zoneLabel={zoneLabel} toolbar={sidebarToolbar}>
            <ZoneTargetEditor zone={selected} dispatch={dispatch} catalog={catalog} />
          </ZoneList>
        ) : null}
      </div>
    </div>
  );
});
