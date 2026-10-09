'use client';

import * as React from 'react';
import { roomCategory } from '@/lib/domain/room-attributes';
import { kebabSuggestion } from '@/lib/domain/slug';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lCategory } from '@/lib/i18n/format';
import { Field, TextInput } from './fields';

/**
 * Name and page address together: the address suggests itself from the name
 * until the user edits it directly, then stops following. It becomes the
 * room's URL and cannot change after this form is saved — `content-service.ts`
 * enforces that server-side; this just says so.
 */
export function NewRoomIdentityFields() {
  const t = useAdminT();
  const locale = useAdminLocale();
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
        label={t('room.name')}
        hint={t('room.nameHint', { category: lCategory(roomCategory({ name }), locale) })}
      >
        <TextInput id="room-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field
        id="room-slug"
        name="slug"
        label={t('room.pageAddress')}
        hint={t('room.pageAddressHint', { slug: slug || '…' })}
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
