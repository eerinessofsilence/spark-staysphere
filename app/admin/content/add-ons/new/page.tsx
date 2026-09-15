import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { AddOnFields } from '@/components/admin/content/add-on-fields';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createAddOnAction } from './actions';

export const metadata: Metadata = { title: 'New add-on — Add-ons | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function NewAddOnPage() {
  const [addOns, assets] = await Promise.all([
    contentService.listAddOnsContent(),
    Promise.resolve(contentService.listMedia()),
  ]);
  const topLevel = addOns.filter((addOn) => !addOn.parentId);

  return (
    <AdminPage width="narrow">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/admin/content/add-ons" className={pill('secondary')}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Add-ons
        </Link>
      </nav>

      <AdminPageHeader
        title="New add-on"
        description="A service or a dish guests can add to their stay. An extra with a parent is offered inside that add-on."
      />

      <div className="mt-8 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm action={createAddOnAction} initialVersion={0} submitLabel="Create add-on" dock>
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
