import type { Metadata } from 'next';
import { contentService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { ContentForm } from '@/components/admin/content/content-form';
import { AddOnFields } from '@/components/admin/content/add-on-fields';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createAddOnAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('addOn.newTitle')) };
}

export const dynamic = 'force-dynamic';

export default async function NewAddOnPage() {
  const [addOns, assets, t] = await Promise.all([
    contentService.listAddOnsContent(),
    Promise.resolve(contentService.listMedia()),
    getAdminT(),
  ]);
  const topLevel = addOns.filter((addOn) => !addOn.parentId);

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.content') }, { label: t('nav.services'), href: '/admin/content/add-ons' }]}
        title={t('addOn.newTitle')}
      />

      <div className="mt-8 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm action={createAddOnAction} initialVersion={0} submitLabel={t('addOn.create')} dock>
          <AddOnFields
            initial={{
              name: '',
              description: '',
              category: 'service',
              photos: [],
              price: 0,
              pricingUnit: 'per_stay',
              enabled: true,
            }}
            topLevelAddOns={topLevel}
            assets={assets}
          />
        </ContentForm>
      </div>
    </AdminPage>
  );
}
