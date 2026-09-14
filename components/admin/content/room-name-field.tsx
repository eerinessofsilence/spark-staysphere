'use client';

import * as React from 'react';
import { roomCategory } from '@/lib/domain/room-attributes';
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
 * The room's catalog category is derived from its name (`roomCategory` in
 * `lib/domain/room-attributes.ts`) — there is no category field to fill in,
 * so this shows what the site will file the room under as the name is typed.
 */
export function RoomNameField({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial);

  return (
    <Field id="room-name" name="name" label="Name" hint={`Filed on the site as: ${CATEGORY_LABELS[roomCategory({ name: value })]}`}>
      <TextInput
        id="room-name"
        name="name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
      />
    </Field>
  );
}
