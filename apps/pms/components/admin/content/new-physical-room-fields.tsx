'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { Field, Select, TextInput } from './fields';

interface RoomTypeOption {
  id: string;
  /** Already in the team member's language (the page builds it with `lFloor`). */
  label: string;
  /** The first free number on the type's own floor. */
  suggestion: string;
}

/**
 * Picking a room type moves the number to the first free one on that type's
 * floor — until the number has been typed over, after which it's left alone.
 */
export function NewPhysicalRoomFields({ types, initialTypeId }: { types: RoomTypeOption[]; initialTypeId: string }) {
  const t = useAdminT();
  const [typeId, setTypeId] = React.useState(initialTypeId);
  const [number, setNumber] = React.useState(types.find((type) => type.id === initialTypeId)?.suggestion ?? '');
  const [typedOver, setTypedOver] = React.useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="unit-roomTypeId" name="roomTypeId" label={t('unit.roomType')}>
        <Select
          id="unit-roomTypeId"
          name="roomTypeId"
          value={typeId}
          required
          onChange={(next) => {
            setTypeId(next);
            if (!typedOver) setNumber(types.find((type) => type.id === next)?.suggestion ?? '');
          }}
        >
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="unit-number" name="number" label={t('unit.number')} hint={t('unit.numberHint')}>
        <TextInput
          id="unit-number"
          name="number"
          value={number}
          onChange={(event) => {
            setNumber(event.target.value.toUpperCase());
            setTypedOver(true);
          }}
          required
          autoComplete="off"
          spellCheck={false}
          maxLength={4}
        />
      </Field>
    </div>
  );
}
