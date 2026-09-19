'use client';

import { curvesOf, isEdgeCurved } from '@/lib/domain/polygon/geometry';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { pluralCount } from '@/lib/i18n/plural';
import type { EditorAction, EditorZone } from './editor-state';
import { IconSpline, IconTrash } from './icons';

/** The zone's name for messages: the label its target resolves to, or its position in the list. */
export function nameOf(zone: EditorZone, index: number, t: AdminT, zoneLabel?: (zone: EditorZone) => string | null): string {
  return zoneLabel?.(zone) || t('editor.zoneN', { n: index + 1 });
}

function pointForms(t: AdminT) {
  return { one: t('zones.pointOne'), few: t('zones.pointFew'), many: t('zones.pointMany'), other: t('zones.pointOther') };
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
  const t = useAdminT();
  const locale = useAdminLocale();
  const forms = pointForms(t);

  return (
    <aside className="pe-float pe-float-left" aria-label={t('zones.title')}>
      <div className="pe-side-head">
        <h2 className="pe-side-title">{t('zones.title')}</h2>
        <span className="pe-muted">{zones.length}</span>
      </div>

      {zones.length === 0 ? (
        <p className="pe-empty">{t('zones.empty')}</p>
      ) : (
        <ul className="pe-list">
          {zones.map((zone, index) => {
            const count = zone.polygon.points.length;
            const name = nameOf(zone, index, t, zoneLabel);
            return (
              <li key={zone.id} className="pe-item" data-selected={selected?.id === zone.id || undefined}>
                <button type="button" className="pe-item-main" onClick={() => dispatch({ type: 'select', id: zone.id })}>
                  <span className="pe-item-index">{index + 1}</span>
                  <span className="pe-item-label">{zoneLabel?.(zone) || t('zones.unbound')}</span>
                  <span className="pe-muted">{pluralCount(locale, count, forms)}</span>
                </button>
                <button
                  type="button"
                  className="pe-item-delete"
                  aria-label={t('zones.delete', { name })}
                  title={t('zones.deleteTitle')}
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
  const t = useAdminT();
  const locale = useAdminLocale();
  const points = pluralCount(locale, selected.polygon.points.length, pointForms(t));
  const curved = curvesOf(selected.polygon).filter(isEdgeCurved).length;

  return (
    <div className="pe-summary">
      <IconSpline />
      <span>{curved > 0 ? t('zones.summaryRounded', { points, count: curved }) : points}</span>
      {curved > 0 ? (
        <button
          type="button"
          className="pe-btn pe-btn-outline pe-push"
          onClick={() => dispatch({ type: 'patch', id: selected.id, patch: { polygon: { points: selected.polygon.points } } })}
        >
          {t('zones.straightenAll')}
        </button>
      ) : null}
    </div>
  );
}
