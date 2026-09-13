import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { pill, tag } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { AddOnFields } from '@/components/admin/content/add-on-fields';
import { DeleteEntityButton } from '@/components/admin/content/delete-entity-button';
import { deleteAddOnAction, updateAddOnAction } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const addOn = await contentService.getAddOnContent(id);
  return { title: `${addOn?.name ?? id} — Content | SPARK StaySphere 360` };
}

export const dynamic = 'force-dynamic';

export default async function AddOnContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [addOn, addOns, assets] = await Promise.all([
    contentService.getAddOnContent(id),
    contentService.listAddOnsContent(),
    Promise.resolve(contentService.listMedia()),
  ]);
  if (!addOn) notFound();

  const topLevel = addOns.filter((candidate) => !candidate.parentId && candidate.id !== addOn.id);
  const boundUpdate = updateAddOnAction.bind(null, id);

  return (
    <>
      <main id="main" className="mx-auto w-full max-w-[900px] px-4 pt-4 pb-16 sm:px-8 lg:pt-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link href="/admin/content" className={pill('secondary')}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Content
          </Link>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-display text-5xl sm:text-6xl">{addOn.name}</h1>
          <div className="flex flex-col items-end gap-3">
            <a href="/rooms" target="_blank" rel="noreferrer" className={pill('secondary')}>
              Open on site
            </a>
            {addOn.enabled ? (
              <span className={tag('bg-tint-sage text-tint-sage-ink')}>On sale</span>
            ) : (
              <span className={tag()}>Withdrawn</span>
            )}
          </div>
        </div>

        <div className="mt-8">
          <ContentForm
            action={boundUpdate}
            initialVersion={addOn.version}
            submitLabel="Save add-on"
            extraActions={
              <DeleteEntityButton
                id={addOn.id}
                label={addOn.name}
                confirmMessage={`Remove the add-on "${addOn.name}"? This cannot be undone.`}
                action={deleteAddOnAction}
              />
            }
          >
            <AddOnFields
              initial={{
                name: addOn.name,
                description: addOn.description,
                category: addOn.category,
                parentId: addOn.parentId,
                photos: addOn.photos?.map((photo) => photo.url) ?? [],
                price: addOn.price,
                pricingUnit: addOn.pricingUnit,
                enabled: addOn.enabled,
              }}
              topLevelAddOns={topLevel}
              assets={assets}
            />
          </ContentForm>
        </div>
      </main>
    </>
  );
}
