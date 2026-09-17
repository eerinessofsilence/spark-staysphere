import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { coverPhoto, roomCategory } from '@/lib/domain/room-attributes';
import { formatMoney, viewLabels } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CatalogTabs } from '@/components/admin/content/catalog-tabs';
import { RowActions } from '@/components/admin/content/row-actions';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deleteRoomAction } from './rooms/[id]/actions';

export const metadata: Metadata = {
  title: 'Room types — Hotel admin | SPARK StaySphere 360',
};

/** Content is read fresh from the overlay on every load, never cached. */
export const dynamic = 'force-dynamic';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Columns a phone can do without: what they say is folded into the first cell there. */
const deskOnly = 'hidden sm:table-cell';

export default async function RoomTypesPage() {
  const [rooms, physicalRooms] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.listPhysicalRoomsContent(),
  ]);
  const rates = await Promise.all(rooms.map((room) => contentService.listRatesContent(room.id)));
  const onSite = rooms.filter((room) => !room.hidden).length;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Rooms"
        actions={
          <>
            <a href="/rooms" target="_blank" rel="noreferrer" className={pill('secondary')}>
              Open the site
              <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
            </a>
            <Link href="/admin/content/rooms/new" className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              New room type
            </Link>
          </>
        }
      />

      <CatalogTabs
        current="types"
        counts={{ types: rooms.length, rooms: physicalRooms.length }}
      />

      {rooms.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No room types yet.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {onSite} of {rooms.length} on the site.
          </p>
          <div className="mt-4">
            <TableCard caption="Room types, their price, and whether guests can see them" className="sm:min-w-[46rem]">
              <thead>
                <tr className="border-b border-border">
                  <Th>Room type</Th>
                  <Th className={deskOnly}>From</Th>
                  <Th className={deskOnly}>Rooms</Th>
                  <Th className={deskOnly}>Status</Th>
                  <Th className="w-14">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, index) => {
                  const cover = coverPhoto(room);
                  const cheapest = [...rates[index]!].sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0];
                  const price = cheapest ? `${formatMoney(cheapest.nightlyPrice, cheapest.currency)} a night` : 'No rate yet';
                  const href = `/admin/content/rooms/${room.id}`;
                  const roomCount = physicalRooms.filter((unit) => unit.roomTypeId === room.id).length;
                  return (
                    <tr
                      key={room.id}
                      className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                    >
                      <Td className="align-middle">
                        {/* Stretched: the row opens the room type's own page from anywhere in
                            it, not only the photo and name — the rooms link and row menu sit
                            at a higher stacking level so their own clicks still reach them. */}
                        <Link href={href} className="group flex items-center gap-3 before:absolute before:inset-0">
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
                      <Td className={cn(deskOnly, 'relative z-10 align-middle tabular-nums')}>
                        <Link
                          href={`/admin/content/units#type-${room.id}`}
                          className={cn('hover:text-accent-strong', roomCount === 0 && 'text-muted-foreground')}
                        >
                          {roomCount === 0 ? 'Add rooms' : roomCount}
                        </Link>
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
                      <Td className="relative z-10 align-middle text-right">
                        <RowActions
                          id={room.id}
                          version={room.version}
                          label={room.name}
                          editHref={href}
                          deleteAction={deleteRoomAction}
                          confirmMessage={`Remove the room type "${room.name}" and its rates? This can't be undone.`}
                          deleteBlockedReason={
                            contentService.isSeedEntry('room', room.id)
                              ? 'Came with the demo catalog'
                              : roomCount > 0
                                ? 'Remove its rooms first'
                                : undefined
                          }
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          </div>
        </>
      )}
    </AdminPage>
  );
}
