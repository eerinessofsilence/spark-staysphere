'use client';

import type { SpinnerZoneTarget } from '@/lib/domain/spinner-markup';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { EditorAction, EditorZone } from './editor-state';

export interface SpinnerMarkupCatalog {
  units: Array<{ id: string; number: string; floor: number; roomTypeId: string; roomTypeName: string }>;
  roomTypes: Array<{ id: string; name: string; floor: number; hidden: boolean }>;
}

type TargetKind = SpinnerZoneTarget['kind'];

const KIND_LABEL: Record<TargetKind, string> = {
  unit: 'Room',
  floor: 'Floor',
  roomType: 'Room type',
  link: 'Link',
};

function defaultTarget(kind: TargetKind, catalog: SpinnerMarkupCatalog): SpinnerZoneTarget {
  switch (kind) {
    case 'unit':
      return { kind, unitId: catalog.units[0]?.id ?? '' };
    case 'floor':
      return { kind, floor: catalog.roomTypes[0]?.floor ?? 1, facade: null };
    case 'roomType':
      return { kind, roomTypeId: catalog.roomTypes[0]?.id ?? '' };
    case 'link':
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
    <div className="pe-target">
      <div className="pe-side-head">
        <h2 className="pe-side-title">Points to</h2>
      </div>
      <div className="pe-scroll">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1 sm:grid-cols-5" role="radiogroup" aria-label="Target kind">
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
              {KIND_LABEL[kind]}
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
            None
          </button>
        </div>

        {!target ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Unbound zones are saved but never shown to a guest until they point somewhere.
          </p>
        ) : null}

        {target?.kind === 'unit' ? (
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            Room
            <select
              value={target.unitId}
              onChange={(event) => setTarget({ kind: 'unit', unitId: event.target.value })}
              className={cn(fieldClass, 'mt-1')}
            >
              {[...unitsByFloor.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([floor, units]) => (
                  <optgroup key={floor} label={`Floor ${floor}`}>
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
              Floor
              <select
                value={target.floor}
                onChange={(event) => setTarget({ kind: 'floor', floor: Number(event.target.value), facade: target.facade })}
                className={cn(fieldClass, 'mt-1')}
              >
                {floors.map((floor) => (
                  <option key={floor} value={floor}>
                    {floor}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Facade
              <select
                value={target.facade ?? ''}
                onChange={(event) =>
                  setTarget({ kind: 'floor', floor: target.floor, facade: event.target.value === '' ? null : (event.target.value as 'sea' | 'town') })
                }
                className={cn(fieldClass, 'mt-1')}
              >
                <option value="">Any</option>
                <option value="sea">Sea</option>
                <option value="town">Town</option>
              </select>
            </label>
          </div>
        ) : null}

        {target?.kind === 'roomType' ? (
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            Room type
            <select
              value={target.roomTypeId}
              onChange={(event) => setTarget({ kind: 'roomType', roomTypeId: event.target.value })}
              className={cn(fieldClass, 'mt-1')}
            >
              {catalog.roomTypes.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                  {room.hidden ? ' (hidden)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {target?.kind === 'link' ? (
          <div className="mt-3 grid gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Label
              <input
                value={target.label}
                onChange={(event) => setTarget({ ...target, label: event.target.value })}
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Description
              <textarea
                value={target.description}
                onChange={(event) => setTarget({ ...target, description: event.target.value })}
                rows={2}
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Link
              <input
                value={target.href}
                onChange={(event) => setTarget({ ...target, href: event.target.value })}
                placeholder="/rooms?view=sea"
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Button text
              <input
                value={target.cta}
                onChange={(event) => setTarget({ ...target, cta: event.target.value })}
                className={cn(fieldClass, 'mt-1')}
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
