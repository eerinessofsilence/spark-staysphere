'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { fieldClass } from '@/lib/ui';
import { chessboardHref } from './chessboard-shared';

interface RoomTypeSelectProps {
  options: { id: string; name: string }[];
  value: string | null;
  from: string;
  days: number;
}

export function RoomTypeSelect({ options, value, from, days }: RoomTypeSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="w-full sm:w-64">
      <label htmlFor="chessboard-room-type" className="sr-only">
        Room type
      </label>
      <select
        id="chessboard-room-type"
        value={value ?? ''}
        disabled={pending}
        onChange={(event) => {
          const type = event.target.value || null;
          startTransition(() => router.replace(chessboardHref({ from, days, type }), { scroll: false }));
        }}
        className={`${fieldClass} disabled:opacity-60`}
      >
        <option value="">All room types</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
