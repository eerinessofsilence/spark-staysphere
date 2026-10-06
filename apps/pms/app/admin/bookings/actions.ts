'use server';

import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { revalidatePath } from 'next/cache';
import { bookingGuestService, bookingService, catalogService } from '@/lib/application/container';
import { inventoryService } from '@/lib/application/container';
import { z } from 'zod';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { bookingGuestInputSchema, stayStateSchema, type StayState } from '@/lib/domain/schemas';
import { getAdminT } from '@/lib/i18n/admin/server';
import { stayStateKey } from '@/lib/i18n/admin/stay-state';

export interface CancelBookingResult {
  ok: boolean;
  message: string;
}

export interface AddBookingGuestResult extends CancelBookingResult {
  fieldErrors?: Record<string, string[]>;
}

const stayTimesSchema = z.object({
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  lateCheckIn: z.boolean(),
  lateCheckOut: z.boolean(),
});

export async function changeBookingTimesAction(reference: string, input: unknown): Promise<CancelBookingResult> {
  const t = await getAdminT();
  try { await requirePermission('team.permViewBookings'); }
  catch (error) { if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') }; throw error; }
  const parsed = stayTimesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t('booking.timeInvalid') };
  try {
    const result = await inventoryService.changeStayTimes(await getSelectedHotelSlug(), reference, parsed.data.checkInTime, parsed.data.checkOutTime, parsed.data.lateCheckIn, parsed.data.lateCheckOut);
    if (result === 'ok') { revalidateBookingViews(); return { ok: true, message: t('booking.timesSaved') }; }
    if (result === 'unchanged') return { ok: true, message: t('booking.timesUnchanged') };
    return { ok: false, message: t(result === 'not_found' ? 'booking.editUnavailable' : 'booking.timeConflict') };
  } catch { return { ok: false, message: t('booking.timeSaveFailed') }; }
}

/** The pages that draw a booking's state: the board, the lists, the booking's own page. */
function revalidateBookingViews() {
  revalidatePath('/admin');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/bookings/[reference]', 'page');
  revalidatePath('/admin/front-desk');
  revalidatePath('/admin/guests/[id]', 'page');
}

export async function addBookingGuestAction(
  reference: string,
  input: unknown,
): Promise<AddBookingGuestResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }

  const fields = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const parsed = bookingGuestInputSchema.safeParse({
    ...fields,
    email: typeof fields.email === 'string' ? fields.email.trim() || undefined : fields.email,
    phone: typeof fields.phone === 'string' ? fields.phone.trim() || undefined : fields.phone,
  });
  if (!parsed.success) {
    return { ok: false, message: t('booking.guestInvalid'), fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const result = await bookingGuestService.add(reference, hotel.id, parsed.data);
  if (result.outcome === 'added') {
    revalidatePath(`/admin/bookings/${reference}`);
    return { ok: true, message: t('booking.guestAdded') };
  }
  const messages = {
    invalid: t('booking.guestInvalid'),
    not_found: t('booking.guestMissing'),
    not_confirmed: t('booking.guestNotConfirmed'),
    full: t('booking.guestFull'),
  };
  return { ok: false, message: messages[result.outcome] };
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

export async function cancelBookingAction(reference: string, reason: string): Promise<CancelBookingResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permCancelBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { ok: false, message: t('ops.cancelReasonRequired') };
  const { outcome } = await bookingService.cancelAsHotel(reference, trimmedReason);

  if (outcome === 'cancelled') {
    revalidateBookingViews();
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
