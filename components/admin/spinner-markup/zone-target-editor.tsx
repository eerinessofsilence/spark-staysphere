'use client';

import type { SpinnerZoneTarget } from '@/lib/domain/spinner-markup';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { lFacade, lFloor } from '@/lib/i18n/format';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { EditorAction, EditorZone } from './editor-state';

export interface SpinnerMarkupCatalog {
  units: Array<{ id: string; number: string; floor: number; roomTypeId: string; roomTypeName: string }>;
  roomTypes: Array<{ id: string; name: string; floor: number; hidden: boolean }>;
}

type TargetKind = SpinnerZoneTarget['kind'];

const KIND_LABEL: Record<TargetKind, AdminTranslationKey> = {
  unit: 'editor.kindRoom',
  floor: 'editor.kindFloor',
  roomType: 'editor.kindRoomType',
  link: 'editor.kindLink',
};

/** The first visible room type, or the first of anything if every one happens to be hidden. */
function firstVisibleRoomType(catalog: SpinnerMarkupCatalog) {
  return catalog.roomTypes.find((room) => !room.hidden) ?? catalog.roomTypes[0];
}

function defaultTarget(kind: TargetKind, catalog: SpinnerMarkupCatalog): SpinnerZoneTarget {
  switch (kind) {
    case 'unit':
      return { kind, unitId: catalog.units[0]?.id ?? '' };
    case 'floor':
      return { kind, floor: firstVisibleRoomType(catalog)?.floor ?? 1, facade: null };
    case 'roomType':
      return { kind, roomTypeId: firstVisibleRoomType(catalog)?.id ?? '' };
    case 'link':
      // The guest sees this on the link's card: it is content the team edits,
      // seeded in the hotel's language, not admin chrome.
      return { kind, label: '', description: '', href: '', cta: 'See more' };
  }
}

/**
 * What the selected zone points to: a physical room, a floor (optionally one
 * facade), a room type directly, or a plain link — see
 * `lib/domain/spinner-markup.ts`. Specific to this repo's catalog, unlike
 * the rest of the ported editor, so it lives beside it rather than inside
 * `svg-editor-kit`'s own reusable files.
 */
export function ZoneTargetEditor({
  zone,
  dispatch,
  catalog,
}: {
  zone: EditorZone | null;
  dispatch: (action: EditorAction) => void;
  catalog: SpinnerMarkupCatalog;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  if (!zone) return null;

  const target = zone.target;

  function setTarget(next: SpinnerZoneTarget | null) {
    dispatch({ type: 'patch', id: zone!.id, patch: { target: next } });
  }

  function setKind(kind: TargetKind | 'none') {
    setTarget(kind === 'none' ? null : defaultTarget(kind, catalog));
  }

  const unitsByFloor = new Map<number, SpinnerMarkupCatalog['units']>();
  for (const unit of catalog.units) {
    (unitsByFloor.get(unit.floor) ?? unitsByFloor.set(unit.floor, []).get(unit.floor)!).push(unit);
  }
  const floors = [...new Set(catalog.roomTypes.map((room) => room.floor))].sort((a, b) => a - b);

  return (
    <section className="pe-panel-section" aria-labelledby="pe-target-heading">
      <h3 id="pe-target-heading" className="pe-section-heading">
        {t('editor.pointsTo')}
      </h3>
      <div>
        <div
          className="grid grid-cols-2 gap-1 rounded-full border border-border p-1 sm:grid-cols-5"
          role="radiogroup"
          aria-label={t('editor.targetKind')}
        >
          {(['unit', 'floor', 'roomType', 'link'] as TargetKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={target?.kind === kind}
              onClick={() => setKind(kind)}
              className={cn(
                'rounded-full px-2 py-1.5 text-xs font-medium',
                target?.kind === kind ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone',
              )}
            >
              {t(KIND_LABEL[kind])}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={!target}
            onClick={() => setKind('none')}
            className={cn(
              'rounded-full px-2 py-1.5 text-xs font-medium',
              !target ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone',
            )}
          >
            {t('editor.kindNone')}
          </button>
        </div>

        {!target ? <p className="mt-3 text-xs text-muted-foreground">{t('editor.unboundHint')}</p> : null}

        {target?.kind === 'unit' ? (
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            {t('editor.kindRoom')}
            <select
              value={target.unitId}
              onChange={(event) => setTarget({ kind: 'unit', unitId: event.target.value })}
              className={cn(fieldClass, 'mt-1')}
            >
              {[...unitsByFloor.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([floor, units]) => (
                  <optgroup key={floor} label={lFloor(floor, locale)}>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.number} — {unit.roomTypeName}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </label>
        ) : null}

        {target?.kind === 'floor' ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              {t('editor.kindFloor')}
              <select
                value={target.floor}
                onChange={(event) => setTarget({ kind: 'floor', floor: Number(event.target.value), facade: target.facade })}
                className={cn(fieldClass, 'mt-1')}
              >
                {floors.map((floor) => (
                  <option key={floor} value={floor}>
                    {lFloor(floor, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {t('editor.facade')}
              <select
                value={target.facade ?? ''}
                onChange={(event) =>
                  setTarget({ kind: 'floor', floor: target.floor, facade: event.target.value === '' ? null : (event.target.value as 'sea' | 'town') })
                }
                className={cn(fieldClass, 'mt-1')}
              >
                <option value="">{t('editor.facadeAny')}</option>
                <option value="sea">{lFacade('sea', locale)}</option>
                <option value="town">{lFacade('town', locale)}</option>
              </select>
            </label>
          </div>
        ) : null}

        {target?.kind === 'roomType' ? (
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            {t('editor.kindRoomType')}
            <select
              value={target.roomTypeId}
              onChange={(event) => setTarget({ kind: 'roomType', roomTypeId: event.target.value })}
              className={cn(fieldClass, 'mt-1')}
            >
              {catalog.roomTypes.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.hidden ? t('editor.hiddenRoomType', { name: room.name }) : room.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {target?.kind === 'link' ? (
          <div className="mt-3 grid gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              {t('editor.label')}
              <input
                value={target.label}
                onChange={(event) => setTarget({ ...target, label: event.target.value })}
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {t('editor.description')}
              <textarea
                value={target.description}
                onChange={(event) => setTarget({ ...target, description: event.target.value })}
                rows={2}
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {t('editor.kindLink')}
              <input
                value={target.href}
                onChange={(event) => setTarget({ ...target, href: event.target.value })}
                placeholder="/rooms?view=sea"
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {t('editor.buttonText')}
              <input
                value={target.cta}
                onChange={(event) => setTarget({ ...target, cta: event.target.value })}
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
          </div>
        ) : null}
      </div>
    </section>
  );
}
