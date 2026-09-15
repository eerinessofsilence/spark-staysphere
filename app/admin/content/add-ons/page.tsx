import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { formatMoney, formatPricingUnit } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CatalogTabs } from '@/components/admin/content/catalog-tabs';
import { RowActions } from '@/components/admin/content/row-actions';
import { AddOnToggle } from '@/components/admin/room-controls';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deleteAddOnAction, setAddOnOnSaleAction } from './[id]/actions';

export const metadata: Metadata = {
  title: 'Add-ons — Hotel admin | SPARK StaySphere 360',
};

export const dynamic = 'force-dynamic';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function AddOnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const removed = typeof params.removed === 'string' ? params.removed : null;
  const [rooms, addOns, physicalRooms] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.listAddOnsContent(),
    contentService.listPhysicalRoomsContent(),
  ]);
  const onSale = addOns.filter((addOn) => addOn.enabled).length;
  const topLevel = addOns.filter((addOn) => !addOn.parentId);
  const categories = [...new Set(topLevel.map((addOn) => addOn.category))];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Rooms & add‑ons"
        compact
        actions={
          <Link href="/admin/content/add-ons/new" className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            New add-on
          </Link>
        }
      />

      <CatalogTabs
        current="addons"
        counts={{ types: rooms.length, rooms: physicalRooms.length, addons: addOns.length }}
      />

      {removed ? (
        <p role="status" className="mt-6 flex items-center gap-3 rounded-3xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle weight="fill" className="size-5 shrink-0 text-success" aria-hidden="true" />
          <span>
            <span className="font-medium">“{removed}”</span> was removed.
          </span>
        </p>
      ) : null}

      {addOns.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No add-ons yet.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {onSale} of {addOns.length} on sale. An extra listed under a service is offered inside it.
          </p>
          <div className="mt-6 grid gap-8">
            {categories.map((category) => {
              const rows = topLevel
                .filter((addOn) => addOn.category === category)
                .flatMap((parent) => [parent, ...addOns.filter((child) => child.parentId === parent.id)]);
              return (
                <section key={category} aria-labelledby={`category-${category}`}>
                  <h2 id={`category-${category}`} className="mb-3 text-base font-medium">
                    {capitalize(category)} <span className="font-normal text-muted-foreground">· {rows.length}</span>
                  </h2>
                  <TableCard caption={`${capitalize(category)} add-ons`} className="sm:min-w-[40rem]">
                    <thead>
                      <tr className="border-b border-border">
                        <Th>Add-on</Th>
                        <Th>Price</Th>
                        <Th>On sale</Th>
                        <Th className="w-14">
                          <span className="sr-only">Actions</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((addOn) => {
                        const href = `/admin/content/add-ons/${addOn.id}`;
                        return (
                          <tr key={addOn.id} className="border-b border-border last:border-b-0">
                            <Td className="align-middle">
                              <Link
                                href={href}
                                className={cn(
                                  'block hover:text-accent-strong',
                                  addOn.parentId ? 'pl-4 sm:pl-6' : 'font-medium',
                                )}
                              >
                                {addOn.parentId ? (
                                  <span className="text-muted-foreground" aria-hidden="true">
                                    +{' '}
                                  </span>
                                ) : null}
                                {addOn.name}
                              </Link>
                            </Td>
                            <Td className="align-middle tabular-nums">
                              <span className="whitespace-nowrap">{formatMoney(addOn.price, addOn.currency)}</span>{' '}
                              <span className="block text-xs text-muted-foreground sm:inline sm:text-sm">
                                {formatPricingUnit(addOn.pricingUnit)}
                              </span>
                            </Td>
                            <Td className="align-middle">
                              {/* The 44px switch target sits on the row's text line, not below it. */}
                              <div className="-my-2.5">
                                <AddOnToggle addOnId={addOn.id} addOnName={addOn.name} enabled={addOn.enabled} action={setAddOnOnSaleAction} />
                              </div>
                            </Td>
                            <Td className="align-middle text-right">
                              <RowActions
                                id={addOn.id}
                                version={addOn.version}
                                label={addOn.name}
                                editHref={href}
                                deleteAction={deleteAddOnAction}
                                confirmMessage={`Remove the add-on "${addOn.name}"? This can't be undone.`}
                                deleteBlockedReason={
                                  contentService.isSeedEntry('addon', addOn.id)
                                    ? 'Came with the demo catalog'
                                    : addOns.some((child) => child.parentId === addOn.id)
                                      ? 'Remove its extras first'
                                      : undefined
                                }
                              />
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableCard>
                </section>
              );
            })}
          </div>
        </>
      )}
    </AdminPage>
  );
}
