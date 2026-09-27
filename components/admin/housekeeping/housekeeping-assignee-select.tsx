'use client';

import * as React from 'react';
import { assignHousekeepingRoomAction } from '@/app/admin/housekeeping/actions';

export function HousekeepingAssigneeSelect({ unitId, memberId, staff }: {
  unitId: string;
  memberId: string | null;
  staff: { id: string; name: string }[];
}) {
  const [value, setValue] = React.useState(memberId ?? '');
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState('');
  return (
    <div className="relative z-10">
      <select aria-label="Назначить хаускипера" value={value} disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          const previous = value;
          setValue(next);
          startTransition(async () => {
            const result = await assignHousekeepingRoomAction(unitId, next || null);
            if (!result.ok) setValue(previous);
            setMessage(result.ok ? '' : result.message);
          });
        }}
        className="min-h-11 max-w-48 rounded-xl border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent">
        <option value="">Не назначен</option>
        {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      {message ? <p role="alert" className="text-xs text-danger">{message}</p> : null}
    </div>
  );
}
