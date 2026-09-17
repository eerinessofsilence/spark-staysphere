import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { formatMoney, formatPricingUnit } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { RowActions } from '@/components/admin/content/row-actions';
import { AddOnToggle } from '@/components/admin/room-controls';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deleteAddOnAction, setAddOnOnSaleAction } from './[id]/actions';

export const metadata: Metadata = {
  title: 'Services — Hotel admin | SPARK StaySphere 360',
};

export const dynamic = 'force-dynamic';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Everything a guest can add to a stay — services and the kitchen's dishes —
 * as its own sidebar item rather than a third tab under Rooms. The route stays
 * `/admin/content/add-ons`: the entity is still an add-on everywhere below.
 */
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const removed = typeof params.removed === 'string' ? params.removed : null;
  const addOns = await contentService.listAddOnsContent();
  const onSale = addOns.filter((addOn) => addOn.enabled).length;
  const topLevel = addOns.filter((addOn) => !addOn.parentId);
  const categories = [...new Set(topLevel.map((addOn) => addOn.category))];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Services"
        actions={
          <Link href="/admin/content/add-ons/new" className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Add service
          </Link>
        }
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
                          <tr
                            key={addOn.id}
                            className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                          >
                            <Td className="align-middle">
                              {/* Stretched: the row opens the add-on's own page from anywhere
                                  in it — the switch and row menu sit at a higher stacking level
                                  so their own clicks still reach them. */}
                              <Link
                                href={href}
                                className={cn(
                                  'block hover:text-accent-strong before:absolute before:inset-0',
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
                            <Td className="relative z-10 align-middle">
                              {/* The 44px switch target sits on the row's text line, not below it. */}
                              <div className="-my-2.5">
                                <AddOnToggle addOnId={addOn.id} addOnName={addOn.name} enabled={addOn.enabled} action={setAddOnOnSaleAction} />
                              </div>
                            </Td>
                            <Td className="relative z-10 align-middle text-right">
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
