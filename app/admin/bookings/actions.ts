'use server';

import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { revalidatePath } from 'next/cache';
import { bookingService, catalogService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { stayStateSchema, type StayState } from '@/lib/domain/schemas';
import { getAdminT } from '@/lib/i18n/admin/server';
import { stayStateKey } from '@/lib/i18n/admin/stay-state';

export interface CancelBookingResult {
  ok: boolean;
  message: string;
}

/** The pages that draw a booking's state: the board, the lists, the booking's own page. */
function revalidateBookingViews() {
  revalidatePath('/admin');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/bookings/[reference]', 'page');
  revalidatePath('/admin/front-desk');
  revalidatePath('/admin/guests/[id]', 'page');
}

/**
 * Check in, check out, no-show — the desk's own moves, so they sit behind the
 * desk's permission (`permViewBookings`, the same one that books a walk-in),
 * not the narrower right to cancel.
 */
export async function setStayStateAction(reference: string, state: StayState): Promise<CancelBookingResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const parsed = stayStateSchema.safeParse(state);
  if (!parsed.success) return { ok: false, message: t('stay.notAllowed') };

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const target = await bookingService.getByReference(reference).catch(() => null);
  if (!target || target.hotelId !== hotel.id) return { ok: false, message: t('ops.cancelMissing') };

  const { outcome, booking } = await bookingService.setStayStateAsHotel(reference, parsed.data);
  switch (outcome) {
    case 'updated':
      revalidateBookingViews();
      return { ok: true, message: t('stay.updated', { reference: booking!.reference, state: t(stayStateKey(parsed.data)) }) };
    case 'not_allowed':
      return { ok: false, message: t('stay.notAllowed') };
    case 'booking_cancelled':
      return { ok: false, message: t('stay.bookingCancelled') };
    default:
      return { ok: false, message: t('ops.cancelMissing') };
  }
}

export async function cancelBookingAction(reference: string): Promise<CancelBookingResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permCancelBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const { outcome } = await bookingService.cancelAsHotel(reference);

  if (outcome === 'cancelled') {
    revalidateBookingViews();
    revalidatePath('/rooms');
  }

  switch (outcome) {
    case 'cancelled':
      return { ok: true, message: t('ops.cancelled') };
    case 'already_cancelled':
      return { ok: true, message: t('ops.cancelAlready') };
    case 'stay_started':
      return { ok: false, message: t('ops.cancelStayStarted') };
    default:
      return { ok: false, message: t('ops.cancelMissing') };
  }
}
