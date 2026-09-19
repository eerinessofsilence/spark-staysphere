'use client';

import * as React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { RateForm } from '@/components/admin/content/rate-form';
import { Field, Select } from '@/components/admin/content/fields';

interface RoomOption {
  id: string;
  name: string;
}

/**
 * Adds a rate from Rates & availability without picking a room type's own
 * page first — the room-type choice lives here, then the rest is the same
 * `RateForm` the CMS uses to add a rate on that room's own page.
 */
export function AddRoomRateButton({
  rooms,
  currency,
  createRateAction,
}: {
  rooms: RoomOption[];
  currency: string;
  createRateAction: (roomTypeId: string, prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const [roomTypeId, setRoomTypeId] = React.useState(rooms[0]?.id ?? '');

  if (rooms.length === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4" aria-hidden="true" />
        {t('rate.addRoomRate')}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t('rate.addRoomRate')} className="sm:max-w-xl">
        <Field id="new-rate-roomTypeId" label={t('rate.roomType')}>
          <Select id="new-rate-roomTypeId" value={roomTypeId} onChange={setRoomTypeId}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-5">
          <RateForm
            key={roomTypeId}
            idPrefix="rate-new"
            formAction={createRateAction.bind(null, roomTypeId)}
            initialVersion={0}
            currency={currency}
            submitLabel={t('rate.add')}
            resetOnSuccess
            bare
          />
        </div>
      </Modal>
    </>
  );
}
