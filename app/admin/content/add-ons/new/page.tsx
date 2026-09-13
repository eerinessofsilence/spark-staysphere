import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { AddOnFields } from '@/components/admin/content/add-on-fields';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { createAddOnAction } from './actions';

export const metadata: Metadata = { title: 'New add-on — Content | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function NewAddOnPage() {
  const [addOns, assets] = await Promise.all([
    contentService.listAddOnsContent(),
    Promise.resolve(contentService.listMedia()),
  ]);
  const topLevel = addOns.filter((addOn) => !addOn.parentId);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[900px] px-3 py-8 sm:px-6 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link href="/admin/content" className={pill('secondary')}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Content
          </Link>
        </nav>

        <h1 className="text-display text-5xl sm:text-6xl">New add-on</h1>

        <div className="mt-8">
          <ContentForm action={createAddOnAction} initialVersion={0} submitLabel="Create add-on">
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
      </main>
      <SiteFooter />
    </>
  );
}
