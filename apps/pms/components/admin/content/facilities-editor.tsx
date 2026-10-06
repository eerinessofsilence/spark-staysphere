'use client';

import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { FacilityIcon, HotelFacility } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { facilityIconKeys, facilityIcons } from '@/components/hotel/facility-icon';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { TextInput } from './fields';

/**
 * The picker's label for a mark, in the team member's language — the fixed
 * vocabulary of `facilityIconSchema`, so chrome, unlike the facility's own
 * name, which is the hotel's.
 */
function iconLabel(t: AdminT, key: FacilityIcon): string {
  return t(`facilities.icon.${key}`);
}

/**
 * The round button shows the mark a facility currently wears; pressing it
 * opens the whole vocabulary as a grid, since a name in a `<select>` says
 * nothing about what the guest will actually see next to the label.
 * Exported: `RoomFacilitiesPicker`'s own inline "add a facility" row reuses
 * it rather than a second copy of the same icon grid.
 */
export function IconPicker({
  value,
  label,
  onChange,
}: {
  value: FacilityIcon;
  label: string;
  onChange: (next: FacilityIcon) => void;
}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const Current = facilityIcons[value].icon;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${iconLabel(t, value)}`}
        className={iconButton('light', 'size-11 data-popup-open:bg-stone')}
      >
        <Current weight="fill" className="size-5" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
          <Popover.Popup className="w-[19.5rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-card p-2 shadow-soft outline-none">
            <div role="listbox" aria-label={t('facilities.iconListbox')} className="grid grid-cols-6 gap-1">
              {facilityIconKeys.map((key) => {
                const Icon = facilityIcons[key].icon;
                const selected = key === value;
                const keyLabel = iconLabel(t, key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={keyLabel}
                    title={keyLabel}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className={cn(
                      'grid size-11 cursor-pointer place-items-center rounded-full transition-colors',
                      selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-stone',
                    )}
                  >
                    <Icon weight="fill" className="size-5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const DEFAULT_ICON: FacilityIcon = 'pool';

/**
 * The hotel's facilities as reorderable rows — an icon and a name each — in
 * the same up/down/remove shape as `OrderedStringList`, serialized into one
 * hidden JSON input. The draft row at the bottom suggests its own name from
 * the icon just picked, until the name has been typed over.
 */
export function FacilitiesEditor({ name, initial }: { name: string; initial: HotelFacility[] }) {
  const t = useAdminT();
  const [items, setItems] = React.useState(initial);
  const [draft, setDraft] = React.useState<HotelFacility>({ icon: DEFAULT_ICON, name: '' });
  const [draftTyped, setDraftTyped] = React.useState(false);
  const rowName = (item: HotelFacility, index: number) =>
    item.name || t('facilities.fallbackName', { index: index + 1 });

  function update(index: number, patch: Partial<HotelFacility>) {
    const next = [...items];
    next[index] = { ...next[index]!, ...patch };
    setItems(next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  }

  function remove(index: number) {
    setItems(items.filter((_, candidate) => candidate !== index));
  }

  function add() {
    const value = draft.name.trim();
    if (!value) return;
    setItems([...items, { icon: draft.icon, name: value }]);
    setDraft({ icon: DEFAULT_ICON, name: '' });
    setDraftTyped(false);
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(items)} />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('facilities.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <IconPicker
                value={item.icon}
                label={t('facilities.iconFor', { name: rowName(item, index) })}
                onChange={(icon) => update(index, { icon })}
              />
              <TextInput
                value={item.name}
                onChange={(event) => update(index, { name: event.target.value })}
                aria-label={t('facilities.rowLabel', { index: index + 1 })}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={t('facilities.moveUp')}
                className={iconButton('light', 'size-9')}
              >
                <ChevronUpIcon className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={t('facilities.moveDown')}
                className={iconButton('light', 'size-9')}
              >
                <ChevronDownIcon className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={t('facilities.remove', { name: rowName(item, index) })}
                className={iconButton('light', 'size-9')}
              >
                <XMarkIcon className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center gap-2">
        <IconPicker
          value={draft.icon}
          label={t('facilities.newIcon')}
          onChange={(icon) => setDraft({ icon, name: draftTyped ? draft.name : iconLabel(t, icon) })}
        />
        <TextInput
          value={draft.name}
          onChange={(event) => {
            setDraft({ ...draft, name: event.target.value });
            setDraftTyped(event.target.value !== '');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={t('facilities.placeholder')}
          aria-label={t('facilities.addLabel')}
          className="flex-1"
        />
        <button type="button" onClick={add} aria-label={t('facilities.addButton')} className={iconButton('dark', 'size-9')}>
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
