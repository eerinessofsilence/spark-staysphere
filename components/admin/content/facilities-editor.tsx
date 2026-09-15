'use client';

import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { FacilityIcon, HotelFacility } from '@/lib/domain/schemas';
import { facilityIconKeys, facilityIcons } from '@/components/hotel/facility-icon';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { TextInput } from './fields';

/**
 * The round button shows the mark a facility currently wears; pressing it
 * opens the whole vocabulary as a grid, since a name in a `<select>` says
 * nothing about what the guest will actually see next to the label.
 */
function IconPicker({
  value,
  label,
  onChange,
}: {
  value: FacilityIcon;
  label: string;
  onChange: (next: FacilityIcon) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const Current = facilityIcons[value].icon;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${facilityIcons[value].label}`}
        className={iconButton('light', 'size-11 data-popup-open:bg-stone')}
      >
        <Current weight="fill" className="size-5" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
          <Popover.Popup className="w-[19.5rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-card p-2 shadow-soft outline-none">
            <div role="listbox" aria-label="Facility icon" className="grid grid-cols-6 gap-1">
              {facilityIconKeys.map((key) => {
                const Icon = facilityIcons[key].icon;
                const selected = key === value;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={facilityIcons[key].label}
                    title={facilityIcons[key].label}
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
  const [items, setItems] = React.useState(initial);
  const [draft, setDraft] = React.useState<HotelFacility>({ icon: DEFAULT_ICON, name: '' });
  const [draftTyped, setDraftTyped] = React.useState(false);

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
        <p className="text-sm text-muted-foreground">No facilities yet — pick an icon below and give it a name.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <IconPicker
                value={item.icon}
                label={`Icon for ${item.name || `facility ${index + 1}`}`}
                onChange={(icon) => update(index, { icon })}
              />
              <TextInput
                value={item.name}
                onChange={(event) => update(index, { name: event.target.value })}
                aria-label={`Facility ${index + 1}`}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                className={iconButton('light', 'size-9')}
              >
                <ChevronUpIcon className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
                className={iconButton('light', 'size-9')}
              >
                <ChevronDownIcon className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${item.name || `facility ${index + 1}`}`}
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
          label="New facility icon"
          onChange={(icon) => setDraft({ icon, name: draftTyped ? draft.name : facilityIcons[icon].label })}
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
          placeholder="Add a facility, e.g. Rooftop bar"
          aria-label="Add a facility"
          className="flex-1"
        />
        <button type="button" onClick={add} aria-label="Add facility" className={iconButton('dark', 'size-9')}>
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
