import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, CheckIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { coverPhoto, roomCategory } from '@/lib/domain/room-attributes';
import { buildRoomUnits } from '@/lib/domain/room-units';
import type { AddOn } from '@/lib/domain/schemas';
import { formatMoney, formatPricingUnit, viewLabels } from '@/lib/formatting';
import { fieldClass, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { AddOnToggle } from '@/components/admin/room-controls';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { setAddOnOnSaleAction } from './add-ons/[id]/actions';

export const metadata: Metadata = {
  title: 'Rooms & add-ons — Hotel admin | SPARK StaySphere 360',
};

/** Content is read fresh from the overlay on every load, never cached. */
export const dynamic = 'force-dynamic';

type Show = 'all' | 'rooms' | 'addons';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hrefFor({ show, q, off }: { show: Show; q: string; off: boolean }): string {
  const params = new URLSearchParams();
  if (show !== 'all') params.set('show', show);
  if (q) params.set('q', q);
  if (off) params.set('status', 'off');
  const search = params.toString();
  return search ? `/admin/content?${search}` : '/admin/content';
}

/** Columns a phone can do without: what they say is folded into the first cell there. */
const deskOnly = 'hidden sm:table-cell';

const filterClass = (current: boolean) =>
  cn(
    'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
    current ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground hover:bg-stone',
  );

export default async function ContentOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const show: Show = params.show === 'rooms' || params.show === 'addons' ? params.show : 'all';
  const off = params.status === 'off';
  const removed = typeof params.removed === 'string' ? params.removed : null;

  const [rooms, addOns] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.listAddOnsContent(),
  ]);
  const rates = await Promise.all(rooms.map((room) => contentService.listRatesContent(room.id)));
  const ratesByRoom = new Map(rooms.map((room, index) => [room.id, rates[index]!]));
  const units = buildRoomUnits(rooms);
  const onSite = rooms.filter((room) => !room.hidden).length;
  const onSale = addOns.filter((addOn) => addOn.enabled).length;

  const needle = q.toLowerCase();
  const visibleRooms = rooms.filter(
    (room) =>
      (!needle || room.name.toLowerCase().includes(needle) || room.slug.includes(needle)) && (!off || room.hidden),
  );
  const addOnHits = new Set(
    addOns
      .filter((addOn) => (!needle || addOn.name.toLowerCase().includes(needle)) && (!off || !addOn.enabled))
      .map((addOn) => addOn.id),
  );
  // A matching extra is shown under its parent for context; a matching parent brings its extras along.
  const rowsFor = (parent: AddOn) => {
    const children = addOns.filter((child) => child.parentId === parent.id);
    const childHits = children.filter((child) => addOnHits.has(child.id));
    if (!addOnHits.has(parent.id) && childHits.length === 0) return [];
    return [parent, ...(off || !addOnHits.has(parent.id) ? childHits : children)];
  };
  const topLevel = addOns.filter((addOn) => !addOn.parentId);
  const categories = [...new Set(topLevel.map((addOn) => addOn.category))]
    .map((category) => ({ category, rows: topLevel.filter((addOn) => addOn.category === category).flatMap(rowsFor) }))
    .filter((group) => group.rows.length > 0);

  const showRooms = show !== 'addons';
  const showAddOns = show !== 'rooms';
  const nothingMatches =
    (q || off) && (!showRooms || visibleRooms.length === 0) && (!showAddOns || categories.length === 0);

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

      {removed ? (
        <p role="status" className="mt-6 flex items-center gap-3 rounded-3xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle weight="fill" className="size-5 shrink-0 text-success" aria-hidden="true" />
          <span>
            <span className="font-medium">“{removed}”</span> was removed.
          </span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter" className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'Everything', rooms.length + addOns.length],
              ['rooms', 'Room types', rooms.length],
              ['addons', 'Add-ons', addOns.length],
            ] as const
          ).map(([value, label, count]) => (
            <Link
              key={value}
              href={hrefFor({ show: value, q, off })}
              aria-current={show === value ? 'page' : undefined}
              className={filterClass(show === value)}
            >
              {label}
              <span className={cn('tabular-nums', show === value ? 'opacity-80' : 'text-muted-foreground')}>{count}</span>
            </Link>
          ))}
          <Link
            href={hrefFor({ show, q, off: !off })}
            aria-current={off ? 'true' : undefined}
            className={filterClass(off)}
          >
            {off ? <CheckIcon className="size-4" aria-hidden="true" /> : null}
            Hidden or withdrawn only
          </Link>
        </nav>

        <form role="search" action="/admin/content" method="get" className="flex w-full gap-2 lg:w-auto">
          {show !== 'all' ? <input type="hidden" name="show" value={show} /> : null}
          {off ? <input type="hidden" name="status" value="off" /> : null}
          <label htmlFor="content-search" className="sr-only">
            Search rooms and add-ons by name
          </label>
          <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="content-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search by name"
              className={cn(fieldClass, 'pl-10')}
            />
          </div>
          <button type="submit" className={pill('secondary')}>
            Search
          </button>
        </form>
      </div>

      {nothingMatches ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
          <MagnifyingGlassIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-display text-2xl">Nothing matches</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {q ? `No room type or add-on is called “${q}”` : 'Nothing is hidden or withdrawn'}
            {q && off ? ' among the hidden and withdrawn ones' : ''}.
          </p>
          <Link href="/admin/content" className={pill('secondary')}>
            Show everything
          </Link>
        </div>
      ) : null}

      {showRooms && visibleRooms.length > 0 ? (
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
                {visibleRooms.map((room) => {
                  const cover = coverPhoto(room);
                  const cheapest = [...(ratesByRoom.get(room.id) ?? [])].sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0];
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
        </section>
      ) : null}

      {showAddOns && categories.length > 0 ? (
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

          <div className="mt-5 grid gap-8">
            {categories.map(({ category, rows }) => (
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
                              className={cn('block hover:text-accent-strong', addOn.parentId ? 'pl-4 sm:pl-6' : 'font-medium')}
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
                              <AddOnToggle
                                addOnId={addOn.id}
                                addOnName={addOn.name}
                                enabled={addOn.enabled}
                                action={setAddOnOnSaleAction}
                              />
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
            ))}
          </div>
        </section>
      ) : null}
    </AdminPage>
  );
}
