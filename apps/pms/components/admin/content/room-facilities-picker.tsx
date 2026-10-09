'use client';

import * as React from 'react';
import { CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { FacilityIcon, HotelFacility } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { addFacilityAction } from '@/app/admin/content/hotel/actions';
import { facilityIcon } from '@/components/hotel/facility-icon';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { IconPicker } from './facilities-editor';
import { TextInput } from './fields';

const DEFAULT_ICON: FacilityIcon = 'pool';

/**
 * Which of the hotel's own facilities (Hotel Settings — the pool, the spa)
 * this room type's own page shows, as toggleable chips rather than a second
 * free-text list: the vocabulary and its icon both already exist, picked
 * once for the whole property, so a room only points at a name from it
 * rather than retyping "25-metre infinity pool" and hoping the guest page's
 * own name-matching (`feature-icon.ts`) draws the same mark.
 *
 * "Add new" opens the same icon-plus-name row `FacilitiesEditor` ends with,
 * so a facility this hotel has never named yet can be created without
 * leaving the room type's own page — `addFacilityAction` appends it to the
 * hotel's list, and it comes back already selected here.
 *
 * `initial === null` — no selection ever made — starts every facility
 * checked, matching what the guest page has always shown for a room type
 * from before this picker existed (`roomTypeSchema`'s own doc comment).
 * Serializes into one hidden JSON input, the same convention
 * `OrderedStringList`/`FacilitiesEditor` use, so the server action reads it
 * with `parseJsonList`.
 */
export function RoomFacilitiesPicker({
  name,
  facilities: initialFacilities,
  initial,
}: {
  name: string;
  facilities: HotelFacility[];
  initial: string[] | null;
}) {
  const t = useAdminT();
  const [facilities, setFacilities] = React.useState(initialFacilities);
  const [selected, setSelected] = React.useState<string[]>(() => initial ?? initialFacilities.map((facility) => facility.name));
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<HotelFacility>({ icon: DEFAULT_ICON, name: '' });
  const [draftTyped, setDraftTyped] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState('');

  function toggle(facilityName: string) {
    setSelected((current) =>
      current.includes(facilityName) ? current.filter((current) => current !== facilityName) : [...current, facilityName],
    );
  }

  function closeAdd() {
    setAdding(false);
    setDraft({ icon: DEFAULT_ICON, name: '' });
    setDraftTyped(false);
    setError('');
  }

  function addFacility() {
    const trimmed = draft.name.trim();
    if (!trimmed) return;
    setError('');
    startTransition(async () => {
      const result = await addFacilityAction(draft.icon, trimmed);
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      setFacilities(result.facilities);
      setSelected((current) => [...current, trimmed]);
      closeAdd();
    });
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />

      {facilities.length === 0 ? <p className="text-sm text-muted-foreground">{t('room.facilitiesPickerEmpty')}</p> : null}

      <div role="group" aria-label={t('room.facilities')} className="flex flex-wrap gap-2">
        {facilities.map((facility) => {
          const Icon = facilityIcon(facility.icon);
          const active = selected.includes(facility.name);
          return (
            <button
              key={facility.name}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(facility.name)}
              className={cn(
                'flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                active ? 'border-primary bg-stone text-foreground' : 'border-border text-muted-foreground hover:bg-stone/60',
              )}
            >
              {active ? (
                <CheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
              )}
              {facility.name}
            </button>
          );
        })}

        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-stone/60"
          >
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            {t('room.addFacility')}
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-3 flex items-center gap-2">
          <IconPicker
            value={draft.icon}
            label={t('facilities.newIcon')}
            onChange={(icon) => setDraft({ icon, name: draftTyped ? draft.name : t(`facilities.icon.${icon}`) })}
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
                addFacility();
              }
            }}
            placeholder={t('facilities.placeholder')}
            aria-label={t('facilities.addLabel')}
            className="flex-1"
            autoFocus
          />
          <button
            type="button"
            onClick={addFacility}
            disabled={pending || !draft.name.trim()}
            aria-label={t('facilities.addButton')}
            className={iconButton('dark', 'size-9')}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={closeAdd} aria-label={t('room.cancelAddFacility')} className={iconButton('light', 'size-9')}>
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
