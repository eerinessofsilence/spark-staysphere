'use client';

import * as React from 'react';
import { addOnIcon } from '@/components/rooms/add-on-icon';
import { Field, TextInput } from './fields';

/**
 * `addOnIcon` (`components/rooms/add-on-icon.ts`) picks the card's mark from
 * this text — there is no icon field to fill in, so the mark it derives is
 * shown live beside the name as it's typed.
 */
export function AddOnNameField({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial);
  const Icon = addOnIcon(value || 'add-on');

  return (
    <Field id="addon-name" name="name" label="Name">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-stone text-foreground">
          <Icon className="size-5" weight="fill" aria-hidden="true" />
        </span>
        <TextInput
          id="addon-name"
          name="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          className="flex-1"
        />
      </div>
    </Field>
  );
}
