'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { cancelBookingAction } from '@/app/admin/bookings/actions';
import { Modal } from '@/components/site/modal';
import { pill } from '@/lib/ui';

export function BookingActions({
  reference,
  canCancel,
  note,
}: {
  reference: string;
  canCancel: boolean;
  note: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const close = React.useCallback(() => setConfirming(false), []);

  const cancel = async () => {
    setPending(true);
    const result = await cancelBookingAction(reference);
    setMessage(result.message);
    setPending(false);
    setConfirming(false);
    router.refresh();
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {canCancel ? (
          <button type="button" onClick={() => setConfirming(true)} className={pill('secondary')}>
            Cancel booking
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMessage('Demo — no email was sent.')}
          className={pill('secondary')}
        >
          Resend confirmation
        </button>
        <a href={`/booking/${reference}`} target="_blank" rel="noreferrer" className={pill('ghost')}>
          Guest&apos;s confirmation page
          <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
        </a>
      </div>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <p role="status" aria-live="polite" className="text-sm font-medium">
        {message}
      </p>

      <Modal open={confirming} onClose={close} title="Cancel booking">
        <p className="text-sm">
          Cancel <span className="font-semibold">{reference}</span>? Its nights go back on sale straight
          away. This demo moves no money, so there is no refund to issue.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={cancel} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Yes, cancel booking
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            Keep booking
          </button>
        </div>
      </Modal>
    </div>
  );
}
