'use client';

import * as React from 'react';
import { Field, Select, TextInput } from './fields';

interface RoomTypeOption {
  id: string;
  label: string;
  /** The first free number on the type's own floor. */
  suggestion: string;
}

const NUMBER_HINT = 'The first digits are the floor: 305 is on the 3rd floor, G04 on the ground floor.';

/**
 * Picking a room type moves the number to the first free one on that type's
 * floor — until the number has been typed over, after which it's left alone.
 */
export function NewPhysicalRoomFields({ types, initialTypeId }: { types: RoomTypeOption[]; initialTypeId: string }) {
  const [typeId, setTypeId] = React.useState(initialTypeId);
  const [number, setNumber] = React.useState(types.find((type) => type.id === initialTypeId)?.suggestion ?? '');
  const [typedOver, setTypedOver] = React.useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="unit-roomTypeId" name="roomTypeId" label="Room type">
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
      <Field id="unit-number" name="number" label="Room number" hint={NUMBER_HINT}>
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

export { NUMBER_HINT };
