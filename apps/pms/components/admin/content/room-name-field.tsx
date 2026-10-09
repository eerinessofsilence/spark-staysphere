'use client';

import * as React from 'react';
import { roomCategory } from '@/lib/domain/room-attributes';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lCategory } from '@/lib/i18n/format';
import { Field, TextInput } from './fields';

/**
 * The room's catalog category is derived from its name (`roomCategory` in
 * `lib/domain/room-attributes.ts`) — there is no category field to fill in,
 * so this shows where the catalog will list the room as the name is typed.
 */
export function RoomNameField({ initial }: { initial: string }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [value, setValue] = React.useState(initial);

  return (
    <Field
      id="room-name"
      name="name"
      label={t('room.name')}
      hint={t('room.nameHint', { category: lCategory(roomCategory({ name: value }), locale) })}
    >
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
