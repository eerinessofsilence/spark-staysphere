import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { contentService, guestAppUrl } from '@/lib/application/container';
import { coverPhoto, roomCategory } from '@/lib/domain/room-attributes';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lCategory, lFloor, lMoney, lView } from '@/lib/i18n/format';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CatalogTabs } from '@/components/admin/content/catalog-tabs';
import { RowActions } from '@/components/admin/content/row-actions';
import { ScanRoomButton } from '@/components/admin/content/scan-room-button';
import { paginate, parsePage, parsePageSize, Pagination, simplePageHref, simplePageSizeHref } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deleteRoomAction } from './rooms/[id]/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('rooms.title')) };
}

/** Content is read fresh from the overlay on every load, never cached. */
export const dynamic = 'force-dynamic';

/** Columns a phone can do without: what they say is folded into the first cell there. */
const deskOnly = 'hidden sm:table-cell';

export default async function RoomTypesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const [rooms, physicalRooms] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.listPhysicalRoomsContent(),
  ]);
  const { pageItems: pageRooms, page: currentPage, totalPages } = paginate(rooms, page, pageSize);
  const pageRates = await Promise.all(pageRooms.map((room) => contentService.listRatesContent(room.id)));
  const pageItems = pageRooms.map((room, index) => ({ room, rates: pageRates[index]! }));
  const pageHref = simplePageHref('/admin/content', pageSize);
  const pageSizeHref = simplePageSizeHref('/admin/content');

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.rooms')}
        actions={
          <>
            {guestAppUrl('/rooms') ? <a href={guestAppUrl('/rooms')!} target="_blank" rel="noreferrer" className={pill('secondary')}>
              {t('rooms.openSite')}
              <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
            </a> : null}
            <ScanRoomButton rooms={rooms.map((room) => ({ id: room.id, name: room.name }))} />
            <Link href="/admin/content/rooms/new" className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              {t('rooms.newType')}
            </Link>
          </>
        }
      />

      <CatalogTabs
        current="types"
        counts={{ types: rooms.length, rooms: physicalRooms.length }}
      />

      {rooms.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('rooms.none')}</p>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('rooms.tableCaption')} className="sm:min-w-[46rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('rooms.thType')}</Th>
                  <Th className={deskOnly}>{t('rooms.thFrom')}</Th>
                  <Th className={deskOnly}>{t('rooms.thRooms')}</Th>
                  <Th className={deskOnly}>{t('rooms.thStatus')}</Th>
                  <Th className="w-14">
                    <span className="sr-only">{t('rooms.thActions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(({ room, rates: roomRates }) => {
                  const cover = coverPhoto(room);
                  const cheapest = [...roomRates].sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0];
                  const cheapestPrice = cheapest ? lMoney(cheapest.nightlyPrice, cheapest.currency, locale) : null;
                  const price = cheapestPrice ? t('rooms.perNight', { price: cheapestPrice }) : t('rooms.noRate');
                  const href = `/admin/content/rooms/${room.id}`;
                  const roomCount = physicalRooms.filter((unit) => unit.roomTypeId === room.id).length;
                  return (
                    <tr
                      key={room.id}
                      className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                    >
                      <Td>
                        {/* Stretched: the row opens the room type's own page from anywhere in
                            it, not only the photo and name — the rooms link and row menu sit
                            at a higher stacking level so their own clicks still reach them. */}
                        <Link href={href} className="group flex items-center gap-3 before:absolute before:inset-0">
                          <span className="block size-14 shrink-0 overflow-hidden rounded-[18px] bg-stone">
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
                              {t('rooms.rowMeta', {
                                category: lCategory(roomCategory(room), locale),
                                floor: lFloor(room.floor, locale),
                                view: lView(room.view, locale),
                              })}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:hidden">
                              <span className="tabular-nums">{price}</span>
                              {room.hidden ? (
                                <span className={tag('py-0.5')}>
                                  <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                                  {t('rooms.hidden')}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td className={cn(deskOnly, 'whitespace-nowrap tabular-nums')}>
                        {cheapestPrice ? (
                          <>
                            {cheapestPrice}
                            <span className="text-muted-foreground"> {t('rooms.aNight')}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{t('rooms.noRate')}</span>
                        )}
                      </Td>
                      <Td className={cn(deskOnly, 'relative z-10 tabular-nums')}>
                        <Link
                          href={`/admin/content/units#type-${room.id}`}
                          className={cn('hover:text-accent-strong', roomCount === 0 && 'text-muted-foreground')}
                        >
                          {roomCount === 0 ? t('rooms.addRooms') : roomCount}
                        </Link>
                      </Td>
                      <Td className={deskOnly}>
                        {room.hidden ? (
                          <span className={tag()}>
                            <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                            {t('rooms.hidden')}
                          </span>
                        ) : (
                          <span className={tag('bg-tint-sage text-tint-sage-ink')}>
                            <CheckCircle weight="fill" className="size-3.5" aria-hidden="true" />
                            {t('rooms.onSite')}
                          </span>
                        )}
                      </Td>
                      <Td className="relative z-10 text-right">
                        <RowActions
                          id={room.id}
                          version={room.version}
                          label={room.name}
                          editHref={href}
                          deleteAction={deleteRoomAction}
                          confirmMessage={t('rooms.confirmRemove', { name: room.name })}
                          deleteBlockedReason={
                            contentService.isSeedEntry('room', room.id)
                              ? t('rooms.blockedSeed')
                              : roomCount > 0
                                ? t('rooms.blockedHasRooms')
                                : undefined
                          }
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={rooms.length}
              pageSize={pageSize}
              hrefFor={pageHref}
              pageSizeHrefFor={pageSizeHref}
            />
          </div>
        </>
      )}
    </AdminPage>
  );
}
