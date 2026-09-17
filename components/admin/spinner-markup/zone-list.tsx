'use client';

import { curvesOf, isEdgeCurved } from '@/lib/domain/polygon/geometry';
import type { EditorAction, EditorZone } from './editor-state';
import { IconSpline, IconTrash } from './icons';

/** The zone's name for messages: the label its target resolves to, or its position in the list. */
export function nameOf(zone: EditorZone, index: number, zoneLabel?: (zone: EditorZone) => string | null): string {
  return zoneLabel?.(zone) || `Zone ${index + 1}`;
}

/**
 * The floating left panel — the editor's "layers": every zone on this frame.
 * Ported from `svg-editor-kit`'s `client/hotspot-list.jsx`, "hotspot" renamed
 * to "zone". What the selected zone points to lives in the right panel
 * (`polygon-editor.tsx`), the way a design tool splits layers from properties.
 */
export function ZoneList({
  zones,
  selected,
  dispatch,
  zoneLabel,
}: {
  zones: EditorZone[];
  selected: EditorZone | null;
  dispatch: (action: EditorAction) => void;
  zoneLabel?: (zone: EditorZone) => string | null;
}) {
  return (
    <aside className="pe-float pe-float-left" aria-label="Zones">
      <div className="pe-side-head">
        <h2 className="pe-side-title">Zones</h2>
        <span className="pe-muted">{zones.length}</span>
      </div>

      {zones.length === 0 ? (
        <p className="pe-empty">No zones yet. Trace one with the polygon (P) or rectangle (R) tool below.</p>
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
    </aside>
  );
}

/** A summary of the selected outline: how many points, how many rounded sides. */
export function ContourSummary({ selected, dispatch }: { selected: EditorZone; dispatch: (action: EditorAction) => void }) {
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
