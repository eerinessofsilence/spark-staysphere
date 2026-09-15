'use server';

import { revalidatePath } from 'next/cache';
import { bookingService } from '@/lib/application/container';

export interface CancelBookingResult {
  ok: boolean;
  message: string;
}

export async function cancelBookingAction(reference: string): Promise<CancelBookingResult> {
  const { outcome } = await bookingService.cancelAsHotel(reference);

  if (outcome === 'cancelled') {
    revalidatePath('/admin');
    revalidatePath('/admin/bookings');
    revalidatePath('/admin/bookings/[reference]', 'page');
    revalidatePath('/admin/tape-chart');
    revalidatePath('/rooms');
  }

  switch (outcome) {
    case 'cancelled':
      return { ok: true, message: 'Booking cancelled. Its nights are back on sale.' };
    case 'already_cancelled':
      return { ok: true, message: 'This booking was already cancelled.' };
    case 'stay_started':
      return { ok: false, message: 'This stay has already begun — an early departure is handled at the desk.' };
    default:
      return { ok: false, message: 'This booking no longer exists.' };
  }
}
