'use server';

import { requireBackOfficeSession } from '@/lib/application/admin-session';
import { subscriptionService } from '@/lib/application/container';

/** Demo only: no provider, charge, or card details. */
export async function confirmSubscriptionDemoPayment() {
  try {
    const session = await requireBackOfficeSession();
    return { ok: true as const, account: await subscriptionService.confirmDemoPayment(session.memberId) };
  } catch {
    return { ok: false as const };
  }
}
