'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { setStayStateAction } from '@/app/admin/bookings/actions';
import type { StayState } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { stayMoveKey } from '@/lib/i18n/admin/stay-state';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';

/**
 * The one move the desk makes from a dashboard row — check this arrival in,
 * check that departure out — as a plain button rather than `StayStateMenu`'s
 * full list, since the row already says which move it is for. It asks once,
 * with the stay's details in front of the desk, before anything changes.
 */
export function StayMoveButton({
  reference,
  from,
  to,
  guestName,
  roomName,
  stay,
  guests,
}: {
  reference: string;
  from: StayState;
  to: StayState;
  guestName: string;
  roomName: string;
  /** The dates, already formatted. */
  stay: string;
  /** The party, already formatted. */
  guests: string;
}) {
  const router = useRouter();
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const close = React.useCallback(() => setOpen(false), []);
  const verb = t(stayMoveKey(from, to));

  function confirm() {
    startTransition(async () => {
      const result = await setStayStateAction(reference, to);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary', 'min-h-9 px-3 text-xs')}>
        {verb}
      </button>

      <Modal open={open} onClose={close} title={`${verb} · ${reference}`} className="sm:max-w-md">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('ops.thGuest')}</dt>
          <dd className="font-medium">{guestName}</dd>
          <dt className="text-muted-foreground">{t('ops.thRoom')}</dt>
          <dd>{roomName}</dd>
          <dt className="text-muted-foreground">{t('dashboard.thStay')}</dt>
          <dd>{stay}</dd>
          <dt className="text-muted-foreground">{t('ops.thGuests')}</dt>
          <dd>{guests}</dd>
        </dl>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} disabled={pending} className={pill('secondary', 'min-h-10 px-4')}>
            {t('frontDesk.cancel')}
          </button>
          <button type="button" onClick={confirm} disabled={pending} className={pill('primary', 'min-h-10 px-5')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {verb}
          </button>
        </div>
      </Modal>
    </>
  );
}
