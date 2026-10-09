import type { Metadata } from 'next';
import Link from 'next/link';
import { Broom } from '@phosphor-icons/react/dist/ssr';
import { availableHotels, catalogService, housekeepingService, maintenanceIssueService, teamService } from '@/lib/application/container';
import { getAdminMember } from '@/lib/application/admin-session';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { HOUSEKEEPING_STATUSES } from '@/lib/domain/housekeeping';
import type { HousekeepingStatus } from '@/lib/domain/schemas';
import { housekeepingStatusKey, occupancyKey } from '@/lib/i18n/admin/housekeeping';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateShort, lFloor } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { HousekeepingStatusMenu } from '@/components/admin/housekeeping/housekeeping-status-menu';
import { HousekeepingAssigneeSelect } from '@/components/admin/housekeeping/housekeeping-assignee-select';
import { AssignHousekeeperButton } from '@/components/admin/housekeeping/assign-housekeeper-button';
import { FilterPills } from '@/components/admin/operations/filter-pills';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('housekeeping.title')) };
}

type Filter = 'all' | HousekeepingStatus;

function parseFilter(value: string | string[] | undefined): Filter {
  return typeof value === 'string' && (HOUSEKEEPING_STATUSES as readonly string[]).includes(value)
    ? (value as HousekeepingStatus)
    : 'all';
}

function hrefFor(filter: Filter, page?: number, pageSize?: number): string {
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('status', filter);
  if (page && page > 1) params.set('page', String(page));
  if (pageSize && pageSize !== PAGE_SIZE) params.set('pageSize', String(pageSize));
  const search = params.toString();
  return search ? `/admin/housekeeping?${search}` : '/admin/housekeeping';
}

/**
 * The housekeeping board: every room of the selected hotel, its cleaning
 * status as a menu (the desk's own pattern), and what today holds for it —
 * so a departed room reads dirty next to the guest who just left, and an
 * arrival next to the one who is coming. A row opens the room's page,
 * where the status is set with a note.
 */
export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const today = toIsoDate(new Date());

  const [currentMember, requestedSlug] = await Promise.all([getAdminMember(), getSelectedHotelSlug()]);
  let hotelSlug = requestedSlug;
  if (currentMember?.role === 'Hotelier') {
    const option = availableHotels.find((hotel) => hotel.slug === requestedSlug && currentMember.hotelIds?.includes(hotel.id))
      ?? availableHotels.find((hotel) => currentMember.hotelIds?.includes(hotel.id));
    if (!option) return <AdminPage><p className="mt-8 text-sm text-muted-foreground">No hotel is assigned to this account.</p></AdminPage>;
    const hotel = await catalogService.getHotel(option.slug);
    if (!(await maintenanceIssueService.canManageHotel(currentMember, hotel.id))) return <AdminPage><p className="mt-8 text-sm text-muted-foreground">No hotel is assigned to this account.</p></AdminPage>;
    hotelSlug = option.slug;
  }
  const [rooms, assignments, staff] = await Promise.all([
    housekeepingService.listRooms(hotelSlug, today),
    housekeepingService.listAssignments(hotelSlug),
    teamService.listMembers(),
  ]);
  const canAssign = currentMember ? await teamService.hasPermission(currentMember.role, 'team.permTeamRoles') : false;
  const assignedByUnit = new Map(assignments.map((assignment) => [assignment.unitId, assignment.memberId]));
  const housekeepers = staff.filter((member) => member.role === 'Housekeeper').map(({ id, name }) => ({ id, name }));
  const counts = Object.fromEntries(HOUSEKEEPING_STATUSES.map((status) => [status, 0])) as Record<
    HousekeepingStatus,
    number
  >;
  for (const room of rooms) counts[room.status] += 1;
  const visible = filter === 'all' ? rooms : rooms.filter((room) => room.status === filter);
  const { pageItems, page: currentPage, totalPages } = paginate(visible, page, pageSize);
  const assignableRooms = rooms.map((room) => ({
    unitId: room.unit.id,
    number: room.unit.number,
    floor: room.unit.floor,
    roomTypeName: room.roomTypeName,
    currentAssigneeName: staff.find((member) => member.id === assignedByUnit.get(room.unit.id))?.name ?? null,
  }));

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('housekeeping.title')}
        actions={canAssign ? <AssignHousekeeperButton rooms={assignableRooms} housekeepers={housekeepers} /> : null}
      />

      <div className="mt-2">
        <FilterPills
          label={t('housekeeping.filterLabel')}
          sheetTitle={t('housekeeping.filterTitle')}
          options={(['all', ...HOUSEKEEPING_STATUSES] as Filter[]).map((option) => ({
            key: option,
            label: option === 'all' ? t('housekeeping.all') : t(housekeepingStatusKey(option)),
            count: option === 'all' ? rooms.length : counts[option],
            href: hrefFor(option),
            current: option === filter,
          }))}
        />
      </div>

      <div className="mt-6">
        {rooms.length === 0 ? (
          <EmptyState title={t('housekeeping.noRooms')} body={t('housekeeping.noRoomsBody')}>
            <Link href="/admin/content/units" className={pill('primary')}>
              {t('nav.rooms')}
            </Link>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title={t('housekeeping.noMatch')} body={t('housekeeping.noMatchBody')}>
            <Link href="/admin/housekeeping" className={pill('secondary')}>
              {t('housekeeping.showAll')}
            </Link>
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('housekeeping.tableCaption')} className="min-w-[52rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('housekeeping.thRoom')}</Th>
                  <Th>{t('housekeeping.thType')}</Th>
                  <Th>{t('housekeeping.thOccupancy')}</Th>
                  <Th>{t('housekeeping.thStatus')}</Th>
                  <Th>{t('housekeeping.thHousekeeper')}</Th>
                  <Th>{t('housekeeping.thUpdated')}</Th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((room) => (
                  <tr
                    key={room.unit.id}
                    className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                  >
                    <Td className="whitespace-nowrap">
                      {/* Stretched: the whole row opens the room's page; the status menu sits above it. */}
                      <Link
                        href={`/admin/housekeeping/${room.unit.id}`}
                        className="text-display text-base tabular-nums hover:text-accent-strong before:absolute before:inset-0"
                      >
                        {room.unit.number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{lFloor(room.unit.floor, locale)}</span>
                    </Td>
                    <Td>{room.roomTypeName}</Td>
                    <Td>
                      {t(occupancyKey(room.occupancy))}
                      {room.guest ? (
                        <span className="block text-xs text-muted-foreground">
                          {room.occupancy === 'departing'
                            ? t('housekeeping.guestLeft', { name: room.guest.name, date: lDateShort(room.guest.checkOut, locale) })
                            : room.occupancy === 'arriving'
                              ? t('housekeeping.guestFrom', { name: room.guest.name, date: lDateShort(room.guest.checkIn, locale) })
                              : t('housekeeping.guestUntil', { name: room.guest.name, date: lDateShort(room.guest.checkOut, locale) })}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="relative z-10">
                      <HousekeepingStatusMenu unitId={room.unit.id} status={room.status} note={room.note} hotelSlug={hotelSlug} />
                      {room.note ? <span className="mt-1 block max-w-64 truncate text-xs text-muted-foreground">{room.note}</span> : null}
                    </Td>
                    <Td>
                      {canAssign ? <HousekeepingAssigneeSelect unitId={room.unit.id} memberId={assignedByUnit.get(room.unit.id) ?? null} staff={housekeepers} />
                        : staff.find((member) => member.id === assignedByUnit.get(room.unit.id))?.name ?? '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {room.updatedAt ? lDateShort(room.updatedAt, locale) : t('housekeeping.notTouched')}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={visible.length}
              pageSize={pageSize}
              hrefFor={(next) => hrefFor(filter, next, pageSize)}
              pageSizeHrefFor={(size) => hrefFor(filter, 1, size)}
            />
          </div>
        )}
      </div>
    </AdminPage>
  );
}

function EmptyState({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
        <Broom weight="fill" className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-display text-2xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  );
}
