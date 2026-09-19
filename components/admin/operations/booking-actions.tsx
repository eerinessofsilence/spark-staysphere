'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { cancelBookingAction } from '@/app/admin/bookings/actions';
import { Modal } from '@/components/site/modal';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

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
  const t = useAdminT();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const close = React.useCallback(() => setConfirming(false), []);
  // The question keeps its placeholder so the reference can be set in bold in the middle of it.
  const [questionBefore, questionAfter] = t('ops.cancelConfirmQuestion').split('{reference}');

  const cancel = async () => {
    setPending(true);
    const result = await cancelBookingAction(reference);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
    setPending(false);
    setConfirming(false);
    router.refresh();
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {canCancel ? (
          <button type="button" onClick={() => setConfirming(true)} className={pill('secondary')}>
            {t('ops.cancelBooking')}
          </button>
        ) : null}
        <a href={`/booking/${reference}`} target="_blank" rel="noreferrer" className={pill('ghost')}>
          {t('ops.guestConfirmationPage')}
          <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
        </a>
      </div>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

      <Modal open={confirming} onClose={close} title={t('ops.cancelBooking')}>
        <p className="text-sm">
          {questionBefore}
          <span className="font-semibold">{reference}</span>
          {questionAfter} {t('ops.cancelConfirmBody')}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={cancel} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('ops.cancelConfirmYes')}
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            {t('ops.keepBooking')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
