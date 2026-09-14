import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { coverPhoto, roomCategory } from '@/lib/domain/room-attributes';
import { buildRoomUnits } from '@/lib/domain/room-units';
import { formatMoney, formatPricingUnit, viewLabels } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { AddOnToggle } from '@/components/admin/room-controls';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = {
  title: 'Rooms & add-ons — Hotel admin | SPARK StaySphere 360',
};

/** Content is read fresh from the overlay on every load, never cached. */
export const dynamic = 'force-dynamic';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Columns a phone can do without: what they say is folded into the first cell there. */
const deskOnly = 'hidden sm:table-cell';

export default async function ContentOverviewPage() {
  const [rooms, addOns] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.listAddOnsContent(),
  ]);
  const rates = await Promise.all(rooms.map((room) => contentService.listRatesContent(room.id)));
  const units = buildRoomUnits(rooms);
  const onSite = rooms.filter((room) => !room.hidden).length;
  const onSale = addOns.filter((addOn) => addOn.enabled).length;
  const topLevel = addOns.filter((addOn) => !addOn.parentId);
  const categories = [...new Set(topLevel.map((addOn) => addOn.category))];

  return (
    <AdminPage>
      <AdminPageHeader
        // A non-breaking hyphen: at phone size the title otherwise breaks inside "add-ons".
        title="Rooms & add‑ons"
        description="What guests see and buy. A save goes live at once — in the catalog, on the floor plan, in the booking flow and in the AI room finder — with no deploy."
        actions={
          <a href="/rooms" target="_blank" rel="noreferrer" className={pill('secondary')}>
            Open the site
            <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <section aria-labelledby="rooms-heading" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="rooms-heading" className="text-display text-3xl">
              Room types
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {onSite} of {rooms.length} on the site, {units.length} rooms in the building.
            </p>
          </div>
          <Link href="/admin/content/rooms/new" className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            New room type
          </Link>
        </div>

        {rooms.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">No room types yet.</p>
        ) : (
          <div className="mt-5">
            <TableCard caption="Room types, their price, and whether guests can see them" className="sm:min-w-[46rem]">
              <thead>
                <tr className="border-b border-border">
                  <Th>Room type</Th>
                  <Th className={deskOnly}>From</Th>
                  <Th className={deskOnly}>Rooms</Th>
                  <Th className={deskOnly}>Status</Th>
                  <Th className={deskOnly}>
                    <span className="sr-only">Edit</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, index) => {
                  const cover = coverPhoto(room);
                  const cheapest = [...rates[index]!].sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0];
                  const price = cheapest ? `${formatMoney(cheapest.nightlyPrice, cheapest.currency)} a night` : 'No rate yet';
                  const href = `/admin/content/rooms/${room.id}`;
                  return (
                    <tr key={room.id} className="border-b border-border last:border-b-0">
                      <Td className="align-middle">
                        <Link href={href} className="group flex items-center gap-3">
                          <span className="block size-14 shrink-0 overflow-hidden rounded-2xl bg-stone">
                            {cover ? (
                              <img
                                src={cover.url}
                                alt=""
                                width={cover.width}
                                height={cover.height}
                                loading="lazy"
                                className="size-full object-cover"
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium group-hover:text-accent-strong">{room.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {capitalize(roomCategory(room))} · floor {room.floor} · {viewLabels[room.view]}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:hidden">
                              <span className="tabular-nums">{price}</span>
                              {room.hidden ? (
                                <span className={tag('py-0.5')}>
                                  <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                                  Hidden
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td className={cn(deskOnly, 'align-middle whitespace-nowrap tabular-nums')}>
                        {cheapest ? (
                          <>
                            {formatMoney(cheapest.nightlyPrice, cheapest.currency)}
                            <span className="text-muted-foreground"> a night</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No rate yet</span>
                        )}
                      </Td>
                      <Td className={cn(deskOnly, 'align-middle tabular-nums')}>
                        {units.filter((unit) => unit.roomTypeId === room.id).length}
                      </Td>
                      <Td className={cn(deskOnly, 'align-middle')}>
                        {room.hidden ? (
                          <span className={tag()}>
                            <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                            Hidden
                          </span>
                        ) : (
                          <span className={tag('bg-tint-sage text-tint-sage-ink')}>
                            <CheckCircle weight="fill" className="size-3.5" aria-hidden="true" />
                            On the site
                          </span>
                        )}
                      </Td>
                      <Td className={cn(deskOnly, 'align-middle text-right')}>
                        <Link href={href} className="font-medium hover:text-accent-strong">
                          Edit<span className="sr-only"> {room.name}</span>
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          </div>
        )}
      </section>

      <section aria-labelledby="addons-heading" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="addons-heading" className="text-display text-3xl">
              Add-ons
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {onSale} of {addOns.length} on sale. An extra listed under a service is offered inside it.
            </p>
          </div>
          <Link href="/admin/content/add-ons/new" className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            New add-on
          </Link>
        </div>

        {addOns.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">No add-ons yet.</p>
        ) : (
          <div className="mt-5 grid gap-8">
            {categories.map((category) => {
              const rows = topLevel
                .filter((addOn) => addOn.category === category)
                .flatMap((parent) => [parent, ...addOns.filter((child) => child.parentId === parent.id)]);
              return (
                <div key={category}>
                  <h3 className="mb-3 text-base font-medium">
                    {capitalize(category)} <span className="font-normal text-muted-foreground">· {rows.length}</span>
                  </h3>
                  <TableCard caption={`${capitalize(category)} add-ons`} className="sm:min-w-[40rem]">
                    <thead>
                      <tr className="border-b border-border">
                        <Th>Add-on</Th>
                        <Th>Price</Th>
                        <Th>On sale</Th>
                        <Th className={deskOnly}>
                          <span className="sr-only">Edit</span>
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
                                <AddOnToggle addOnId={addOn.id} addOnName={addOn.name} enabled={addOn.enabled} />
                              </div>
                            </Td>
                            <Td className={cn(deskOnly, 'align-middle text-right')}>
                              <Link href={href} className="font-medium hover:text-accent-strong">
                                Edit<span className="sr-only"> {addOn.name}</span>
                              </Link>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableCard>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminPage>
  );
}
