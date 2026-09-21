'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { bookingService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';

export interface RecordPaymentResult {
  ok: boolean;
  message: string;
}

/**
 * The desk's own "Add payment" — money that moved outside the guest's own
 * checkout (a POS terminal, cash, a bank transfer landing) — behind the same
 * permission a walk-in booking takes, since it is the same front-desk moment.
 */
export async function recordPaymentAction(reference: string, provider: string, amount: number): Promise<RecordPaymentResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }

  const { outcome, booking } = await bookingService.recordManualPayment(reference, provider, amount);
  switch (outcome) {
    case 'recorded':
      revalidatePath('/admin');
      revalidatePath('/admin/accounting');
      revalidatePath('/admin/bookings/[reference]', 'page');
      return { ok: true, message: t('accounting.paymentRecorded', { reference: booking!.reference }) };
    case 'cancelled':
      return { ok: false, message: t('accounting.paymentBookingCancelled') };
    case 'invalid_amount':
      return { ok: false, message: t('accounting.invalidAmount') };
    default:
      return { ok: false, message: t('ops.cancelMissing') };
  }
}
