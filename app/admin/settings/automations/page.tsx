import type { Metadata } from 'next';
import { EMAIL_AUTOMATION_KINDS, type EmailAutomationKind } from '@/lib/domain/ports';
import { emailAutomationsService, emailDeliveryConfigured } from '@/lib/application/container';
import { requirePermission } from '@/lib/application/admin-session';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { AutomationToggle } from '@/components/admin/settings/automation-toggle';
import { setAutomationEnabledAction } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('automations.title')) };
}

const COPY: Record<EmailAutomationKind, { label: 'automations.bookingConfirmed' | 'automations.arrivalReminder' | 'automations.bookingCancelled' | 'automations.checkedOut'; body: 'automations.bookingConfirmedBody' | 'automations.arrivalReminderBody' | 'automations.bookingCancelledBody' | 'automations.checkedOutBody' }> = {
  booking_confirmed: { label: 'automations.bookingConfirmed', body: 'automations.bookingConfirmedBody' },
  arrival_reminder: { label: 'automations.arrivalReminder', body: 'automations.arrivalReminderBody' },
  booking_cancelled: { label: 'automations.bookingCancelled', body: 'automations.bookingCancelledBody' },
  checked_out: { label: 'automations.checkedOut', body: 'automations.checkedOutBody' },
};

export default async function AutomationsPage() {
  await requirePermission('team.permIntegrations');
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const hotelSlug = await getSelectedHotelSlug();
  const settings = await emailAutomationsService.listSettings(hotelSlug);
  const live = emailDeliveryConfigured();

  return (
    <AdminPage width="narrow">
      <AdminPageHeader title={t('automations.title')} description={t('automations.body')} />

      <p className="mt-4 text-sm text-muted-foreground">
        {live ? t('automations.deliveryLive', { provider: 'Resend' }) : t('automations.deliveryDemo')}
      </p>

      <ul className="mt-6 grid gap-3">
        {EMAIL_AUTOMATION_KINDS.map((kind) => (
          <li key={kind} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <label htmlFor={`automation-${kind}`} className="min-w-0">
              <span className="block font-medium">{t(COPY[kind].label)}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{t(COPY[kind].body)}</span>
            </label>
            <AutomationToggle kind={kind} enabled={settings[kind]} label={t(COPY[kind].label)} action={setAutomationEnabledAction} />
          </li>
        ))}
      </ul>
    </AdminPage>
  );
}
