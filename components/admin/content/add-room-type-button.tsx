'use client';

import * as React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { MediaAsset } from '@/lib/domain/ports';
import { bedLabels, viewLabels } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { createRoomAction } from '@/app/admin/content/rooms/new/actions';
import { ContentForm } from '@/components/admin/content/content-form';
import { Field, Select, TextArea, TextInput } from '@/components/admin/content/fields';
import { MediaListEditor } from '@/components/admin/content/media-list-editor';
import { NewRoomIdentityFields } from '@/components/admin/content/new-room-identity-fields';
import { Modal } from '@/components/site/modal';

/**
 * A compact version of `/admin/content/rooms/new`'s form, for adding a room
 * type from wherever a hotel team is already looking (the tape chart)
 * instead of sending them across the app. Saving redirects to the new type's
 * own page — the same place the full page lands — to add a rate, more
 * photos, and its physical rooms.
 */
export function AddRoomTypeButton({ assets }: { assets: MediaAsset[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4" aria-hidden="true" />
        Add room type
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New room type" className="sm:max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Starts hidden from the site. Give it a rate and its own rooms afterwards, from its page.
        </p>

        <div className="mt-5">
          <ContentForm action={createRoomAction} initialVersion={0} submitLabel="Create room type">
            <div className="grid gap-5">
              <NewRoomIdentityFields />

              <Field id="room-description" name="description" label="Description" hint="Plain text, no formatting.">
                <TextArea id="room-description" name="description" required />
              </Field>

              <div className="grid gap-4 sm:grid-cols-4">
                <Field id="room-areaM2" name="areaM2" label="Size (m²)">
                  <TextInput id="room-areaM2" name="areaM2" type="number" min={1} step="0.1" required />
                </Field>
                <Field id="room-floor" name="floor" label="Floor">
                  <TextInput id="room-floor" name="floor" type="number" min={0} step="1" required />
                </Field>
                <Field id="room-capacity" name="capacity" label="Sleeps">
                  <TextInput id="room-capacity" name="capacity" type="number" min={1} step="1" required />
                </Field>
                <Field id="room-bedType" name="bedType" label="Bed">
                  <Select id="room-bedType" name="bedType" defaultValue="king" required>
                    {Object.entries(bedLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field id="room-view" name="view" label="View">
                <Select id="room-view" name="view" defaultValue="sea" required className="sm:w-56">
                  {Object.entries(viewLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <div role="group" aria-labelledby="room-media-heading">
                <h3 id="room-media-heading" className="text-sm font-medium">
                  Photo
                </h3>
                <div className="mt-2">
                  <MediaListEditor name="media" initial={[]} assets={assets} />
                </div>
              </div>
            </div>
          </ContentForm>
        </div>
      </Modal>
    </>
  );
}
