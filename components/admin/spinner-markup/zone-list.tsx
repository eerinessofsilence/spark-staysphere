'use client';

import type * as React from 'react';
import { curvesOf, isEdgeCurved } from '@/lib/domain/polygon/geometry';
import type { EditorAction, EditorZone } from './editor-state';
import { IconSpline, IconTrash } from './icons';

/** The zone's name for messages: the label its target resolves to, or its position in the list. */
export function nameOf(zone: EditorZone, index: number, zoneLabel?: (zone: EditorZone) => string | null): string {
  return zoneLabel?.(zone) || `Zone ${index + 1}`;
}

/**
 * Right panel: a summary of the selected outline, and the list of every
 * zone. Ported from `svg-editor-kit`'s `client/hotspot-list.jsx` — "hotspot"
 * renamed to "zone" throughout, and English copy. Target editing (which
 * unit, floor, room type or link a zone points to) is a separate panel,
 * `ZoneTargetEditor`, composed alongside this one in `polygon-editor.tsx`:
 * it is specific to this repo's catalog, not something the reusable list
 * itself should know about.
 */
export function ZoneList({
  zones,
  selected,
  dispatch,
  zoneLabel,
  children,
}: {
  zones: EditorZone[];
  selected: EditorZone | null;
  dispatch: (action: EditorAction) => void;
  zoneLabel?: (zone: EditorZone) => string | null;
  /** `ZoneTargetEditor`, rendered below the list — see `polygon-editor.tsx`. */
  children?: React.ReactNode;
}) {
  return (
    <aside className="pe-side pe-side-right">
      <div className="pe-side-head">
        <h2 className="pe-side-title">Zones</h2>
        <span className="pe-muted">{zones.length}</span>
      </div>

      {selected ? (
        <ContourSummary selected={selected} dispatch={dispatch} />
      ) : (
        <p className="pe-summary">Trace a zone (P or R), or pick one already drawn (V).</p>
      )}

      {zones.length === 0 ? (
        <p className="pe-empty">No zones yet.</p>
      ) : (
        <ul className="pe-list">
          {zones.map((zone, index) => {
            const count = zone.polygon.points.length;
            const name = nameOf(zone, index, zoneLabel);
            return (
              <li key={zone.id} className="pe-item" data-selected={selected?.id === zone.id || undefined}>
                <button type="button" className="pe-item-main" onClick={() => dispatch({ type: 'select', id: zone.id })}>
                  <span className="pe-item-index">{index + 1}</span>
                  <span className="pe-item-label">{zoneLabel?.(zone) || 'Unbound zone'}</span>
                  <span className="pe-muted">
                    {count} {count === 1 ? 'point' : 'points'}
                  </span>
                </button>
                <button
                  type="button"
                  className="pe-item-delete"
                  aria-label={`Delete: ${name}`}
                  title="Delete"
                  onClick={() => dispatch({ type: 'remove', id: zone.id })}
                >
                  <IconTrash />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {children}
    </aside>
  );
}

/** A summary of the selected outline: how many points, how many rounded sides. */
function ContourSummary({ selected, dispatch }: { selected: EditorZone; dispatch: (action: EditorAction) => void }) {
  const points = selected.polygon.points.length;
  const curved = curvesOf(selected.polygon).filter(isEdgeCurved).length;

  return (
    <div className="pe-summary">
      <IconSpline />
      <span>
        {points} {points === 1 ? 'point' : 'points'}
        {curved > 0 ? `, ${curved} rounded` : ''}
      </span>
      {curved > 0 ? (
        <button
          type="button"
          className="pe-btn pe-btn-outline pe-push"
          onClick={() => dispatch({ type: 'patch', id: selected.id, patch: { polygon: { points: selected.polygon.points } } })}
        >
          Straighten all
        </button>
      ) : null}
    </div>
  );
}
