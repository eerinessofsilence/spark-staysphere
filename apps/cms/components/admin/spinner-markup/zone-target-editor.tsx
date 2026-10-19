'use client';

import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lFloor, lRoomNumber } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { EditorAction, EditorZone } from './editor-state';
import { IconTrash } from './icons';

export interface SpinnerMarkupCatalog {
  units: Array<{ id: string; number: string; floor: number; roomTypeId: string; roomTypeName: string; photo?: string }>;
  roomTypes: Array<{ id: string; name: string; floor: number; hidden: boolean }>;
}

/** New bindings point straight to a physical room. Legacy targets stay intact
 * until the editor explicitly selects a room; opening a zone never changes it. */
export function ZoneTargetEditor({ zone, dispatch, catalog }: {
  zone: EditorZone | null;
  dispatch: (action: EditorAction) => void;
  catalog: SpinnerMarkupCatalog;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  if (!zone) return null;

  const target = zone.target;
  const selected = target?.kind === 'unit' ? catalog.units.find((unit) => unit.id === target.unitId) : undefined;
  const legacyTarget = target && !selected;
  const unitsByFloor = new Map<number, SpinnerMarkupCatalog['units']>();
  for (const unit of catalog.units) {
    const units = unitsByFloor.get(unit.floor) ?? [];
    units.push(unit);
    unitsByFloor.set(unit.floor, units);
  }

  return (
    <section className="pe-panel-section" aria-labelledby="pe-room-label">
      <label id="pe-room-label" htmlFor="pe-room-select" className="pe-section-heading block">
        {t('editor.kindRoom')}
      </label>
      <select
        id="pe-room-select"
        value={selected?.id ?? ''}
        disabled={catalog.units.length === 0}
        aria-describedby={!selected ? 'pe-room-hint' : undefined}
        onChange={(event) => dispatch({ type: 'patch', id: zone.id, patch: { target: { kind: 'unit', unitId: event.target.value } } })}
        className={cn(fieldClass, 'w-full min-w-0 text-sm')}
      >
        <option value="" disabled>{t(catalog.units.length === 0 ? 'editor.noRooms' : 'editor.chooseRoom')}</option>
        {[...unitsByFloor.entries()].sort((a, b) => a[0] - b[0]).map(([floor, units]) => (
          <optgroup key={floor} label={lFloor(floor, locale)}>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.number} — {unit.roomTypeName}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {selected ? (
        <div className="mt-3 overflow-hidden rounded-[18px] border border-border" data-testid="zone-room-preview">
          {selected.photo ? <div className="p-3 pb-0"><img src={selected.photo} alt={selected.roomTypeName} className="aspect-video w-full object-cover" /></div> : null}
          <div className="space-y-1 p-3">
            <p className="font-medium text-foreground">{lRoomNumber(selected.number, locale)}</p>
            <p className="break-words text-sm text-foreground">{selected.roomTypeName}</p>
            <p className="text-xs text-muted-foreground">{lFloor(selected.floor, locale)}</p>
          </div>
        </div>
      ) : (
        <p id="pe-room-hint" className="mt-3 text-xs text-muted-foreground">
          {t(catalog.units.length === 0 ? 'editor.noRoomsHint' : legacyTarget ? 'editor.existingBindingHint' : 'editor.chooseRoomHint')}
        </p>
      )}
      {target ? (
        <button
          type="button"
          className={pill('ghost', 'mt-2 px-3 text-xs text-danger hover:bg-danger/10')}
          onClick={() => dispatch({ type: 'patch', id: zone.id, patch: { target: null } })}
        >
          <IconTrash weight="fill" className="size-4 shrink-0" aria-hidden="true" />
          {t('editor.unlinkRoom')}
        </button>
      ) : null}
    </section>
  );
}
