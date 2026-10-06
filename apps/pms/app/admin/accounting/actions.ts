'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { bookingService, teamService } from '@/lib/application/container';
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
  let session;
  try {
    session = await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }

  const member = await teamService.findMemberById(session.memberId);
  const operator = { id: session.memberId, name: member?.name ?? session.memberId };
  const { outcome, booking } = await bookingService.recordManualPayment(reference, provider, amount, operator);
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

export async function recordRefundAction(reference: string, provider: string, amount: number, vatRate: number, comment: string, scope: 'full' | 'items', itemIds: string[], reason: string): Promise<RecordPaymentResult> {
  const t = await getAdminT();
  let session;
  try { session = await requirePermission('team.permViewBookings'); }
  catch (error) { if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') }; throw error; }
  if ((scope !== 'full' && scope !== 'items') || (scope === 'items' && itemIds.length === 0) || !reason.trim()) return { ok: false, message: t('accounting.refundDetailsRequired') };
  const member = await teamService.findMemberById(session.memberId);
  const operator = { id: session.memberId, name: member?.name ?? session.memberId };
  const { outcome, booking } = await bookingService.recordRefund(reference, provider, amount, vatRate, comment, scope, itemIds.slice(0, 50), reason, operator);
  if (outcome === 'recorded') {
    revalidatePath('/admin'); revalidatePath('/admin/accounting'); revalidatePath('/admin/accounting/invoices');
    revalidatePath('/admin/bookings/[reference]', 'page');
    return { ok: true, message: t('accounting.refundRecorded', { reference: booking!.reference }) };
  }
  if (outcome === 'exceeds_paid') return { ok: false, message: t('accounting.refundExceedsPaid') };
  if (outcome === 'invalid_amount') return { ok: false, message: t('accounting.invalidAmount') };
  return { ok: false, message: t('ops.cancelMissing') };
}
