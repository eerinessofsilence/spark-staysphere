'use client';

import * as React from 'react';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import type { RateTemplate } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { Modal } from '@/components/site/modal';
import { RateForm } from '@/components/admin/content/rate-form';
import { Field, Select } from '@/components/admin/content/fields';
import { AddActionButton } from '@/components/admin/add-action-button';

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
  templates = [],
  createRateAction,
}: {
  rooms: RoomOption[];
  currency: string;
  templates?: RateTemplate[];
  createRateAction: (roomTypeId: string, prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const [roomTypeId, setRoomTypeId] = React.useState(rooms[0]?.id ?? '');

  if (rooms.length === 0) return null;

  return (
    <>
      <AddActionButton onClick={() => setOpen(true)}>
        {t('rate.addRoomRate')}
      </AddActionButton>

      <Modal open={open} onClose={() => setOpen(false)} title={t('rate.addRoomRate')} className="sm:max-w-xl">
        {rooms.length === 1 ? (
          <p className="text-sm text-muted-foreground">{rooms[0]!.name}</p>
        ) : (
          <Field id="new-rate-roomTypeId" label={t('rate.roomType')}>
            <Select id="new-rate-roomTypeId" value={roomTypeId} onChange={setRoomTypeId}>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="mt-5">
          <RateForm
            key={roomTypeId}
            idPrefix="rate-new"
            formAction={createRateAction.bind(null, roomTypeId)}
            initialVersion={0}
            templates={templates}
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
