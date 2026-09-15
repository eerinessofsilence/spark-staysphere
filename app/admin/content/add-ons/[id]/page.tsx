import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { CheckCircle, MinusCircle } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { pill, tag } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { AddOnFields } from '@/components/admin/content/add-on-fields';
import { DeleteEntityButton } from '@/components/admin/content/delete-entity-button';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deleteAddOnAction, updateAddOnAction } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const addOn = await contentService.getAddOnContent(id);
  return { title: `${addOn?.name ?? id} — Add-ons | SPARK StaySphere 360` };
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
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Content' }, { label: 'Add-ons', href: '/admin/content/add-ons' }]}
        title={addOn.name}
        actions={
          <>
            {addOn.enabled ? (
              <span className={tag('bg-tint-sage text-tint-sage-ink')}>
                <CheckCircle weight="fill" className="size-3.5" aria-hidden="true" />
                On sale
              </span>
            ) : (
              <span className={tag()}>
                <MinusCircle weight="fill" className="size-3.5" aria-hidden="true" />
                Withdrawn
              </span>
            )}
            <a href="/rooms" target="_blank" rel="noreferrer" className={pill('secondary')}>
              Open the site
              <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
            </a>
          </>
        }
      />

      <div className="mt-8 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm
          action={boundUpdate}
          initialVersion={addOn.version}
          submitLabel="Save add-on"
          dock
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
    </AdminPage>
  );
}
