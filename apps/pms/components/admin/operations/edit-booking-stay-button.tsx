'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { reviewFrontDeskStayExtensionAction, confirmFrontDeskStayExtensionAction } from '@/app/admin/front-desk/actions';
import { changeBookingTimesAction } from '@/app/admin/bookings/actions';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lMoney } from '@/lib/i18n/format';
import type { StayExtensionReview } from '@/lib/application/inventory-service';
import type { Currency } from '@/lib/domain/schemas';
import { pill } from '@/lib/ui';

interface Props {
  reference: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  lateCheckIn: boolean;
  lateCheckOut: boolean;
  roomTypeId: string;
  roomNumber: string | null;
  currency: Currency;
  canEdit: boolean;
}

const fieldClass = 'mt-1 w-full min-h-11 rounded-xl border border-border bg-card px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function EditBookingStayButton({ reference, checkIn, checkOut, checkInTime, checkOutTime, lateCheckIn, lateCheckOut, roomTypeId, roomNumber, currency, canEdit }: Props) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [arrival, setArrival] = React.useState(checkIn);
  const [departure, setDeparture] = React.useState(checkOut);
  const [arrivalTime, setArrivalTime] = React.useState(checkInTime);
  const [departureTime, setDepartureTime] = React.useState(checkOutTime);
  const [lateArrival, setLateArrival] = React.useState(lateCheckIn);
  const [lateDeparture, setLateDeparture] = React.useState(lateCheckOut);
  const [review, setReview] = React.useState<StayExtensionReview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => setMounted(true), []);

  const close = () => { if (!busy) { setOpen(false); setReview(null); setError(''); } };
  const reviewDates = async () => {
    if (!roomNumber || (arrival === checkIn && departure === checkOut)) return;
    setBusy(true); setError('');
    try {
      const result = await reviewFrontDeskStayExtensionAction({ reference, roomTypeId, roomNumber, newCheckIn: arrival, newCheckOut: departure });
      if (result.ok) setReview(result.review);
      else setError(result.message);
    } catch { setError(t('booking.dateSaveFailed')); }
    finally { setBusy(false); }
  };
  const confirmDates = async () => {
    if (!review || !roomNumber) return;
    setBusy(true); setError('');
    try {
      const result = await confirmFrontDeskStayExtensionAction({ reference, roomTypeId, roomNumber,
        newCheckIn: review.newCheckIn, newCheckOut: review.newCheckOut,
        expectedOldTotal: review.oldTotal, expectedNewTotal: review.newTotal });
      if (result.ok) { setOpen(false); setReview(null); toast.success(t('frontDesk.dateChangeSaved')); router.refresh(); }
      else { setReview(null); setError(result.message); }
    } catch { setError(t('booking.dateSaveFailed')); }
    finally { setBusy(false); }
  };
  const saveTimes = async () => {
    setBusy(true); setError('');
    try {
      const result = await changeBookingTimesAction(reference, { checkInTime: arrivalTime, checkOutTime: departureTime, lateCheckIn: lateArrival, lateCheckOut: lateDeparture });
      if (result.ok) { setOpen(false); toast.success(result.message); router.refresh(); }
      else setError(result.message);
    } catch { setError(t('booking.timeSaveFailed')); }
    finally { setBusy(false); }
  };

  return (
    <>
      {canEdit ? <button type="button" disabled={!mounted} className={pill('secondary', 'mt-4 min-h-9 px-3 text-xs')} onClick={() => setOpen(true)}>
        <PencilSquareIcon className="size-4" aria-hidden="true" />{t('booking.editStay')}
      </button> : null}
      <Modal open={open} onClose={close} title={t('booking.editStay')} className="sm:max-w-lg">
        <div className="space-y-6">
          <div role="group" aria-labelledby="booking-dates-heading">
            <h3 id="booking-dates-heading" className="text-base font-semibold">{t('booking.stayDates')}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">{t('ops.thCheckIn')}<input className={fieldClass} type="date" value={arrival} onChange={(event) => { setArrival(event.target.value); setReview(null); }} /></label>
              <label className="text-sm">{t('ops.thCheckOut')}<input className={fieldClass} type="date" min={arrival} value={departure} onChange={(event) => { setDeparture(event.target.value); setReview(null); }} /></label>
            </div>
            {roomNumber ? <p className="mt-2 text-xs text-muted-foreground">{t('booking.dateReviewHint')}</p> : <p className="mt-2 text-xs text-muted-foreground">{t('booking.dateRoomRequired')}</p>}
            {review ? <div className="mt-3 rounded-xl bg-stone p-3 text-sm" role="status">
              <p>{t('frontDesk.dateChangeDates', { oldCheckIn: review.checkIn, oldCheckOut: review.oldCheckOut, newCheckIn: review.newCheckIn, newCheckOut: review.newCheckOut })}</p>
              <p className="mt-1 font-medium">{t('frontDesk.dateChangeOldPrice')}: {lMoney(review.oldTotal, currency, locale)} → {t('frontDesk.dateChangeNewPrice')}: {lMoney(review.newTotal, currency, locale)}</p>
            </div> : null}
            <button type="button" className={pill(review ? 'primary' : 'secondary', 'mt-3 min-h-10 px-4 text-sm')} disabled={busy || !roomNumber || arrival >= departure || (arrival === checkIn && departure === checkOut)} onClick={review ? confirmDates : reviewDates}>
              {busy ? t('booking.saving') : review ? t('frontDesk.dateChangeConfirm') : t('booking.reviewDates')}
            </button>
          </div>
          <div role="group" aria-labelledby="booking-times-heading" className="border-t border-border pt-5">
            <h3 id="booking-times-heading" className="text-base font-semibold">{t('booking.arrivalDepartureTime')}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">{t('booking.arrivalTime')}<input className={fieldClass} type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} /></label>
              <label className="text-sm">{t('booking.departureTime')}<input className={fieldClass} type="time" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} /></label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={lateArrival} onChange={(event) => setLateArrival(event.target.checked)} />{t('booking.lateCheckIn')}</label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={lateDeparture} onChange={(event) => setLateDeparture(event.target.checked)} />{t('booking.lateCheckOut')}</label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('booking.timePolicyHint')}</p>
            <button type="button" className={pill('primary', 'mt-3 min-h-10 px-4 text-sm')} disabled={busy || !arrivalTime || !departureTime || (arrivalTime === checkInTime && departureTime === checkOutTime && lateArrival === lateCheckIn && lateDeparture === lateCheckOut)} onClick={saveTimes}>
              {busy ? t('booking.saving') : t('booking.saveTimes')}
            </button>
          </div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}
