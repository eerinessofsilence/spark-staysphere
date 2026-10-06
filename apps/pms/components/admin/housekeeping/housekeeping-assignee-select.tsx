'use client';

import * as React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { assignHousekeepingRoomAction } from '@/app/admin/housekeeping/actions';
import { useAdminT } from '@/lib/i18n/admin/context';

export function HousekeepingAssigneeSelect({ unitId, memberId, staff }: {
  unitId: string;
  memberId: string | null;
  staff: { id: string; name: string }[];
}) {
  const t = useAdminT();
  const [value, setValue] = React.useState(memberId ?? '');
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState('');
  return (
    <div className="relative z-10 inline-block w-48 max-w-full">
      {/* `select` is a replaced element and shrinks to its own content width by default; the wrapping `div` is a plain block box and would otherwise stretch to fill the table cell — mismatched widths sent the chevron below (positioned off *this* div's right edge) drifting past the select's own visible border. `inline-block` on the div plus `w-full` on the select keeps the two the same width, always. */}
      <select aria-label={t('housekeeping.assignHousekeeper')} value={value} disabled={pending}
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
        className="min-h-11 w-full appearance-none rounded-xl border border-border bg-card py-2 pr-9 pl-3 text-sm focus-visible:outline-2 focus-visible:outline-accent">
        <option value="">{t('housekeeping.notAssigned')}</option>
        {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      {message ? <p role="alert" className="text-xs text-danger">{message}</p> : null}
    </div>
  );
}
