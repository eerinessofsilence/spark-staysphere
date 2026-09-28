'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/application/admin-session';
import { emailAutomationsService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { EmailAutomationKind } from '@/lib/domain/ports';
import { getAdminT } from '@/lib/i18n/admin/server';

export interface AutomationToggleResult {
  ok: boolean;
  message: string;
}

const LABEL_KEY: Record<EmailAutomationKind, 'automations.bookingConfirmed' | 'automations.arrivalReminder' | 'automations.bookingCancelled' | 'automations.checkedOut'> = {
  booking_confirmed: 'automations.bookingConfirmed',
  arrival_reminder: 'automations.arrivalReminder',
  booking_cancelled: 'automations.bookingCancelled',
  checked_out: 'automations.checkedOut',
};

export async function setAutomationEnabledAction(kind: EmailAutomationKind, enabled: boolean): Promise<AutomationToggleResult> {
  const t = await getAdminT();
  await requirePermission('team.permIntegrations');
  const hotelSlug = await getSelectedHotelSlug();
  const ok = await emailAutomationsService.setEnabled(hotelSlug, kind, enabled);
  if (!ok) return { ok: false, message: t('automations.hotelNotFound') };
  revalidatePath('/admin/settings/automations');
  return { ok: true, message: t('automations.updated', { automation: t(LABEL_KEY[kind]), state: enabled ? t('automations.on') : t('automations.off') }) };
}
