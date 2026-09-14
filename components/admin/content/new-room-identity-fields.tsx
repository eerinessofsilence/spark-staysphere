'use client';

import * as React from 'react';
import { roomCategory } from '@/lib/domain/room-attributes';
import { kebabSuggestion } from '@/lib/domain/slug';
import { Field, TextInput } from './fields';

const CATEGORY_LABELS: Record<ReturnType<typeof roomCategory>, string> = {
  room: 'Room',
  studio: 'Studio',
  suite: 'Suite',
  loft: 'Loft',
  residence: 'Residence',
  penthouse: 'Penthouse',
};

/**
 * Name and page address together: the address suggests itself from the name
 * until the user edits it directly, then stops following. It becomes the
 * room's URL and cannot change after this form is saved — `content-service.ts`
 * enforces that server-side; this just says so.
 */
export function NewRoomIdentityFields() {
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);

  React.useEffect(() => {
    if (!slugTouched) setSlug(kebabSuggestion(name));
  }, [name, slugTouched]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="room-name"
        name="name"
        label="Name"
        hint={`Listed in the catalog under ${CATEGORY_LABELS[roomCategory({ name })]} — it follows the name.`}
      >
        <TextInput id="room-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field
        id="room-slug"
        name="slug"
        label="Page address"
        hint={`The room's page will be /rooms/${slug || '…'} — it can't be changed later.`}
      >
        <TextInput
          id="room-slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugTouched(true);
          }}
          required
        />
      </Field>
    </div>
  );
}
