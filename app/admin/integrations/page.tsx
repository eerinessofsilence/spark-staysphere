import type { Metadata } from 'next';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { demoControl } from '@/lib/application/container';
import type { IntegrationStatus } from '@/lib/domain/schemas';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT, type AdminT } from '@/lib/i18n/admin/translate';
import { lDate } from '@/lib/i18n/format';
import { tag } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { IntegrationConnect } from '@/components/admin/settings/integration-connect';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('integrations.title')) };
}

function details(t: AdminT): Record<IntegrationStatus['adapter'], { name: string; syncs: string; steps: string[] }> {
  return {
    pms: {
      name: t('integrations.pmsName'),
      syncs: t('integrations.pmsSyncs'),
      steps: [t('integrations.pmsStep1'), t('integrations.pmsStep2'), t('integrations.pmsStep3')],
    },
    channel_manager: {
      name: t('integrations.cmName'),
      syncs: t('integrations.cmSyncs'),
      steps: [t('integrations.cmStep1'), t('integrations.cmStep2')],
    },
    booking_engine: {
      name: t('integrations.beName'),
      syncs: t('integrations.beSyncs'),
      steps: [t('integrations.beStep1')],
    },
    payment: {
      name: t('integrations.payName'),
      syncs: t('integrations.paySyncs'),
      steps: [t('integrations.payStep1'), t('integrations.payStep2')],
    },
    crm: {
      name: t('integrations.crmName'),
      syncs: t('integrations.crmSyncs'),
      steps: [t('integrations.crmStep1')],
    },
  };
}

const MODE_KEY = {
  mock: 'integrations.modeMock',
  sandbox: 'integrations.modeSandbox',
  production: 'integrations.modeProduction',
} as const satisfies Record<IntegrationStatus['mode'], string>;

export default async function IntegrationsPage() {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const statuses = await demoControl.listIntegrationStatuses();
  const detail = details(t);

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('integrations.title')}
        actions={<span className={tag()}>{t('integrations.mockTag')}</span>}
      />

      <ul className="mt-10 overflow-hidden rounded-[18px] bg-card shadow-soft">
        {statuses.map((status) => {
          const item = detail[status.adapter];
          return (
            <li
              key={status.adapter}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 last:border-b-0 sm:px-6"
            >
              <div className="min-w-0 max-w-2xl">
                <h2 className="font-medium">{item.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.syncs}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className={tag()}>{t(MODE_KEY[status.mode])}</span>
                  {status.connected ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                      {t('integrations.connectedMock')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-warning">
                      <WarningCircle weight="fill" className="size-4" aria-hidden="true" />
                      {t('integrations.notConnected')}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {status.lastSyncAt
                      ? t('integrations.lastSync', { date: lDate(status.lastSyncAt.slice(0, 10), locale) })
                      : t('integrations.lastSyncNever')}
                  </span>
                </p>
              </div>
              <IntegrationConnect name={item.name} connected={status.connected} steps={item.steps} />
            </li>
          );
        })}
      </ul>
    </AdminPage>
  );
}
