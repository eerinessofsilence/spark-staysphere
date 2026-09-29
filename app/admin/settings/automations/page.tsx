import type { Metadata } from 'next';
import type { EmailAutomationRule } from '@/lib/domain/ports';
import { emailAutomationsService, emailDeliveryConfigured } from '@/lib/application/container';
import { requirePermission } from '@/lib/application/admin-session';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { triggerLabel } from '@/lib/i18n/admin/automation-trigger';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT, type AdminT } from '@/lib/i18n/admin/translate';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { AutomationEditorButton } from '@/components/admin/settings/automation-editor-button';
import { AutomationRow } from '@/components/admin/settings/automation-row';
import { deleteAutomationAction, previewAutomationAction, saveAutomationAction, setAutomationEnabledAction } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('automations.title')) };
}

/** The four rules the product ships with keep their own hand-written copy; a custom rule shows its own subject and describes itself off its trigger. */
const BUILTIN_COPY: Record<string, { label: AdminTranslationKey; body: AdminTranslationKey }> = {
  builtin_booking_confirmed: { label: 'automations.bookingConfirmed', body: 'automations.bookingConfirmedBody' },
  builtin_arrival_reminder: { label: 'automations.arrivalReminder', body: 'automations.arrivalReminderBody' },
  builtin_booking_cancelled: { label: 'automations.bookingCancelled', body: 'automations.bookingCancelledBody' },
  builtin_checked_out: { label: 'automations.checkedOut', body: 'automations.checkedOutBody' },
};

/** Only the time-based built-in (the arrival reminder) has a `days` to drift from — see `rowCopy`. */
const BUILTIN_DEFAULT_DAYS: Record<string, number> = {
  builtin_arrival_reminder: 1,
};

/**
 * A built-in's title is its product name; its subtitle is the hand-written
 * description only while its trigger still matches the shipped default —
 * once the team edits `days` away from that (an arrival reminder moved from
 * one day to two), the subtitle switches to describing the trigger as it
 * actually stands now, same as a custom rule's, so the row never reads
 * stale next to what Edit actually shows.
 */
function rowCopy(rule: EmailAutomationRule, t: AdminT): { title: string; subtitle: string } {
  const builtin = BUILTIN_COPY[rule.id];
  const defaultDays = BUILTIN_DEFAULT_DAYS[rule.id];
  if (builtin && (defaultDays === undefined || rule.trigger.days === defaultDays)) return { title: t(builtin.label), subtitle: t(builtin.body) };
  return { title: builtin ? t(builtin.label) : rule.subject, subtitle: triggerLabel(rule.trigger, t) };
}

export default async function AutomationsPage() {
  await requirePermission('team.permIntegrations');
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const hotelSlug = await getSelectedHotelSlug();
  const rules = await emailAutomationsService.listRules(hotelSlug);
  const live = emailDeliveryConfigured();

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title={t('automations.title')}
        description={t('automations.body')}
        actions={<AutomationEditorButton saveAction={saveAutomationAction} previewAction={previewAutomationAction} />}
      />

      <p className="mt-4 text-sm text-muted-foreground">
        {live ? t('automations.deliveryLive', { provider: 'Resend' }) : t('automations.deliveryDemo')}
      </p>

      <ul className="mt-6 grid w-full min-w-0 max-w-full gap-3">
        {rules.map((rule) => {
          const { title, subtitle } = rowCopy(rule, t);
          return (
            <AutomationRow
              key={rule.id}
              rule={rule}
              title={title}
              subtitle={subtitle}
              enabledAction={setAutomationEnabledAction}
              saveAction={saveAutomationAction}
              previewAction={previewAutomationAction}
              deleteAction={deleteAutomationAction}
            />
          );
        })}
      </ul>
    </AdminPage>
  );
}
