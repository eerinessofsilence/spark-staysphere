'use client';

import * as React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { addSampleBookings } from '@/app/admin/actions';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

/**
 * Fills an empty demo with a dozen believable stays (see
 * `lib/application/sample-bookings.ts`). The page re-renders from the
 * action's revalidation; the line below only speaks up when nothing was
 * added, which would otherwise look like the button did nothing.
 */
export function SampleBookingsButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { created } = await addSampleBookings();
            if (created > 0) toast.success(`${created} sample ${created === 1 ? 'booking' : 'bookings'} added.`);
            else toast.error('Nothing added — the sample stays are already in, or their rooms are full.');
          })
        }
        className={pill(variant)}
      >
        {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? 'Adding sample bookings…' : 'Add sample bookings'}
      </button>
    </div>
  );
}
