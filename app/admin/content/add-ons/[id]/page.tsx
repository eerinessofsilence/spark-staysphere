import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { AddOnFields } from '@/components/admin/content/add-on-fields';
import { AddOnSaleToggle } from '@/components/admin/content/add-on-sale-toggle';
import { DeleteEntityButton } from '@/components/admin/content/delete-entity-button';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deleteAddOnAction, setAddOnOnSaleAction, updateAddOnAction } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const addOn = await contentService.getAddOnContent(id);
  return { title: `${addOn?.name ?? id} — Add-ons | SPARK StaySphere 360` };
}

export const dynamic = 'force-dynamic';

export default async function AddOnContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [addOn, addOns, assets] = await Promise.all([
    contentService.getAddOnContent(id),
    contentService.listAddOnsContent(),
    Promise.resolve(contentService.listMedia()),
  ]);
  if (!addOn) notFound();
  const removal = await contentService.addOnRemoval(id);

  const topLevel = addOns.filter((candidate) => !candidate.parentId && candidate.id !== addOn.id);
  const boundUpdate = updateAddOnAction.bind(null, id);
  const justCreated = query.created === '1';

  return (
    <AdminPage width="narrow">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/admin/content/add-ons" className={pill('secondary')}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Add-ons
        </Link>
      </nav>

      <AdminPageHeader
        title={addOn.name}
        actions={
          <>
            <AddOnSaleToggle addOnId={addOn.id} enabled={addOn.enabled} action={setAddOnOnSaleAction} />
            <a href="/rooms" target="_blank" rel="noreferrer" className={pill('secondary')}>
              Open the site
              <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
            </a>
          </>
        }
      />

      {justCreated ? (
        <p role="status" className="mt-6 flex items-start gap-3 rounded-3xl border border-success/30 bg-success/10 p-4 text-sm">
          <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <span>
            <span className="font-medium">Add-on created.</span>{' '}
            {addOn.enabled ? 'Guests can add it to their stay now.' : 'It stays withdrawn until you put it on sale.'}
          </span>
        </p>
      ) : null}

      <div className="mt-8 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm
          action={boundUpdate}
          initialVersion={addOn.version}
          submitLabel="Save add-on"
          versionKey={`addon:${addOn.id}`}
          dock
          extraActions={
            removal.allowed ? (
              <DeleteEntityButton
                id={addOn.id}
                version={addOn.version}
                label={addOn.name}
                noun="add-on"
                action={deleteAddOnAction}
                afterDeleteHref={`/admin/content/add-ons?removed=${encodeURIComponent(addOn.name)}`}
              />
            ) : (
              <span className="text-xs text-muted-foreground">{removal.reason}</span>
            )
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
            showOnSale={false}
          />
        </ContentForm>
      </div>
    </AdminPage>
  );
}
