'use client';

import * as React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { RoomType } from '@/lib/domain/schemas';
import { bedLabels, viewLabels } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { createRoomAction } from '@/app/admin/content/rooms/new/actions';
import { ContentForm } from '@/components/admin/content/content-form';
import { Field, Select, TextArea, TextInput } from '@/components/admin/content/fields';
import type { MediaItemDraft } from '@/components/admin/content/media-list-editor';
import { NewRoomIdentityFields } from '@/components/admin/content/new-room-identity-fields';
import { Modal } from '@/components/site/modal';

type RoomTypeTemplate = Pick<
  RoomType,
  'id' | 'name' | 'description' | 'areaM2' | 'floor' | 'capacity' | 'bedType' | 'view' | 'media'
>;

/**
 * A compact version of `/admin/content/rooms/new`'s form, for adding a room
 * type from wherever a hotel team is already looking (the front desk)
 * instead of sending them across the app. Saving redirects to the new type's
 * own page — the same place the full page lands — to add a rate, more
 * photos, and its physical rooms.
 */
export function AddRoomTypeButton({ roomTypes }: { roomTypes: RoomTypeTemplate[] }) {
  const [open, setOpen] = React.useState(false);
  const [templateId, setTemplateId] = React.useState('');
  const template = roomTypes.find((room) => room.id === templateId) ?? null;
  const templateMedia: MediaItemDraft[] = (template?.media ?? [])
    .filter((item): item is MediaItemDraft & { type: 'image' | '360' } => item.type === 'image' || item.type === '360')
    .map((item) => ({ type: item.type, url: item.url, label: item.label }));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4" aria-hidden="true" />
        {/* Label only — this still creates a room type; there's no multi-property support yet. */}
        Add property
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add property" className="sm:max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Starts hidden from the site. Give it a rate and its own rooms afterwards, from its page —
          its photos come from the room type picked below, or add its own there.
        </p>

        <div className="mt-5">
          <ContentForm action={createRoomAction} initialVersion={0} submitLabel="Create room type">
            <div className="grid gap-5">
              <NewRoomIdentityFields />

              {roomTypes.length > 0 ? (
                <Field
                  id="new-room-template"
                  label="Room type"
                  hint="Optional — copies its size, view, description, and photos, so you only change what's different."
                >
                  <Select id="new-room-template" value={templateId} onChange={setTemplateId}>
                    <option value="">Start blank</option>
                    {roomTypes.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <div className="grid gap-5" key={templateId}>
                <Field id="room-description" name="description" label="Description" hint="Plain text, no formatting.">
                  <TextArea id="room-description" name="description" defaultValue={template?.description} required />
                </Field>

                <div className="grid gap-4 sm:grid-cols-4">
                  <Field id="room-areaM2" name="areaM2" label="Size (m²)">
                    <TextInput
                      id="room-areaM2"
                      name="areaM2"
                      type="number"
                      min={1}
                      step="0.1"
                      defaultValue={template?.areaM2}
                      required
                    />
                  </Field>
                  <Field id="room-floor" name="floor" label="Floor">
                    <TextInput
                      id="room-floor"
                      name="floor"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={template?.floor}
                      required
                    />
                  </Field>
                  <Field id="room-capacity" name="capacity" label="Sleeps">
                    <TextInput
                      id="room-capacity"
                      name="capacity"
                      type="number"
                      min={1}
                      step="1"
                      defaultValue={template?.capacity}
                      required
                    />
                  </Field>
                  <Field id="room-bedType" name="bedType" label="Bed">
                    <Select id="room-bedType" name="bedType" defaultValue={template?.bedType ?? 'king'} required>
                      {Object.entries(bedLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field id="room-view" name="view" label="View">
                  <Select id="room-view" name="view" defaultValue={template?.view ?? 'sea'} required className="sm:w-56">
                    {Object.entries(viewLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* No photo editor here — its photos are whichever the picked room type already has; add its own from the room's page. */}
                <input type="hidden" name="media" value={JSON.stringify(templateMedia)} />
              </div>
            </div>
          </ContentForm>
        </div>
      </Modal>
    </>
  );
}
