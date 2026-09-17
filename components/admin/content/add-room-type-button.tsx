'use client';

import * as React from 'react';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { RoomType } from '@/lib/domain/schemas';
import { kebabSuggestion } from '@/lib/domain/slug';
import { pill } from '@/lib/ui';
import { createRoomAction } from '@/app/admin/content/rooms/new/actions';
import { ContentForm, useFieldError } from '@/components/admin/content/content-form';
import { Field, Select, TextInput } from '@/components/admin/content/fields';
import { Modal } from '@/components/site/modal';

type RoomTypeTemplate = Pick<
  RoomType,
  'id' | 'name' | 'description' | 'areaM2' | 'floor' | 'capacity' | 'bedType' | 'view' | 'amenities' | 'media'
>;

/**
 * Adds a room type from the front desk by copying an existing one: only the
 * name is new, everything else comes from the picked type and can be changed
 * afterwards on the new type's own page, where saving lands.
 */
export function AddRoomTypeButton({ roomTypes }: { roomTypes: RoomTypeTemplate[] }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [templateId, setTemplateId] = React.useState(roomTypes[0]?.id ?? '');
  const template = roomTypes.find((room) => room.id === templateId);

  const label = (
    <>
      <PlusIcon className="size-4" aria-hidden="true" />
      Add property
    </>
  );

  if (!template) {
    return (
      <Link href="/admin/content/rooms/new" className={pill('primary')}>
        {label}
      </Link>
    );
  }

  const media = template.media
    .filter((item) => item.type === 'image' || item.type === '360')
    .map((item) => ({ type: item.type, url: item.url, label: item.label }));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        {label}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add property">
        <ContentForm action={createRoomAction} initialVersion={0} submitLabel="Add property" bare>
          <div className="grid gap-5">
            <Field id="property-name" name="name" label="Name">
              <TextInput
                id="property-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <SlugError />

            <Field
              id="property-room-type"
              label="Room type"
              hint="Description, size, view, amenities and photos come from this room type."
            >
              <Select id="property-room-type" value={templateId} onChange={setTemplateId} required>
                {roomTypes.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Link
              href="/admin/content/rooms/new"
              onClick={() => setOpen(false)}
              className="-mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:text-accent-strong"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Create Property
            </Link>

            <input type="hidden" name="slug" value={kebabSuggestion(name)} />
            <input type="hidden" name="description" value={template.description} />
            <input type="hidden" name="areaM2" value={template.areaM2} />
            <input type="hidden" name="floor" value={template.floor} />
            <input type="hidden" name="capacity" value={template.capacity} />
            <input type="hidden" name="bedType" value={template.bedType} />
            <input type="hidden" name="view" value={template.view} />
            <input type="hidden" name="amenities" value={JSON.stringify(template.amenities)} />
            <input type="hidden" name="media" value={JSON.stringify(media)} />
          </div>
        </ContentForm>
      </Modal>
    </>
  );
}

/** The page address is derived from the name, so a clash with an existing one is reported here. */
function SlugError() {
  const error = useFieldError('slug');
  if (!error?.trim()) return null;
  return (
    <p role="alert" className="-mt-3 text-xs font-medium text-danger">
      {error === 'That page address is already in use.' ? 'A room type with this name already exists.' : error}
    </p>
  );
}
