import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilSquareIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { availableHotels, catalogService, housekeepingService, maintenanceIssueService } from '@/lib/application/container';
import { getAdminMember } from '@/lib/application/admin-session';
import { findMemberById } from '@/lib/application/team-directory';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { housekeepingStatusKey, occupancyKey } from '@/lib/i18n/admin/housekeeping';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateRange, lFacade, lFloor, lRoomNumber } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { CleaningLogFilters } from '@/components/admin/housekeeping/cleaning-log-filters';
import { HousekeepingStatusForm } from '@/components/admin/housekeeping/housekeeping-status-form';
import { paginate, parsePage, parsePageSize, Pagination, PAGE_SIZE } from '@/components/admin/operations/pagination';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

async function loadRoom(id: string, requestedSlug?: string) {
  let slug = await getSelectedHotelSlug();
  const member = await getAdminMember();
  if (member?.role === 'Hotelier') {
    const desiredSlug = requestedSlug ?? slug;
    const option = desiredSlug
      ? availableHotels.find((hotel) => hotel.slug === desiredSlug && member.hotelIds?.includes(hotel.id))
      : availableHotels.find((hotel) => member.hotelIds?.includes(hotel.id));
    const assignedOption = option ?? availableHotels.find((hotel) => member.hotelIds?.includes(hotel.id));
    if (!assignedOption) return { room: null, slug };
    const hotel = await catalogService.getHotel(assignedOption.slug);
    if (!(await maintenanceIssueService.canManageHotel(member, hotel.id))) return { room: null, slug: assignedOption.slug };
    slug = assignedOption.slug;
  } else if (requestedSlug && availableHotels.some((hotel) => hotel.slug === requestedSlug) && (member?.role === 'Housekeeper' || member?.role === 'Owner')) {
    slug = requestedSlug;
  }
  return { room: await housekeepingService.getRoom(slug, decodeURIComponent(id), toIsoDate(new Date())), slug };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, locale] = await Promise.all([params, getAdminLocale()]);
  const { room } = await loadRoom(id);
  return { title: adminPageTitle(adminT(locale), room ? lRoomNumber(room.unit.number, locale) : id) };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HousekeepingRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, locale, sp] = await Promise.all([params, getAdminLocale(), searchParams]);
  const t = adminT(locale);
  const requestedSlug = first(sp.hotel);
  const { room, slug } = await loadRoom(id, requestedSlug);
  if (!room) notFound();
  const allEvents = await housekeepingService.listEvents(slug, room.unit.id);

  const memberFilter = first(sp.member) ?? null;
  const rawFrom = first(sp.from);
  const from = rawFrom && ISO_DAY.test(rawFrom) ? rawFrom : null;
  const rawTo = first(sp.to);
  const to = from && rawTo && ISO_DAY.test(rawTo) ? rawTo : from;
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);

  const events = allEvents.filter((event) => {
    if (memberFilter && event.memberId !== memberFilter) return false;
    if (from) {
      const day = event.occurredAt.slice(0, 10);
      if (day < from || day > (to ?? from)) return false;
    }
    return true;
  });
  const { pageItems: shownEvents, page: currentPage, totalPages } = paginate(events, page, pageSize);
  const members = Array.from(new Set(allEvents.map((event) => event.memberId))).map((memberId) => ({
    id: memberId,
    name: findMemberById(memberId)?.name ?? memberId,
  }));
  const memberNames = new Map(members.map((m) => [m.id, m.name]));
  const basePath = `/admin/housekeeping/${id}`;
  function hrefFor(page?: number, pageSize?: number): string {
    const urlParams = new URLSearchParams();
    urlParams.set('hotel', slug);
    if (memberFilter) urlParams.set('member', memberFilter);
    if (from) { urlParams.set('from', from); urlParams.set('to', to ?? from); }
    if (page && page > 1) urlParams.set('page', String(page));
    if (pageSize && pageSize !== PAGE_SIZE) urlParams.set('pageSize', String(pageSize));
    const search = urlParams.toString();
    return search ? `${basePath}?${search}` : basePath;
  }

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: t('housekeeping.title'), href: '/admin/housekeeping' }]}
        title={lRoomNumber(room.unit.number, locale)}
        description={[room.roomTypeName, lFloor(room.unit.floor, locale), lFacade(room.facade, locale)].join(' · ')}
      />

      <div className="mt-8 grid gap-6">
        <HousekeepingStatusForm
          unitId={room.unit.id}
          status={room.status}
          note={room.note}
          updatedAt={room.updatedAt}
          hotelSlug={slug}
        />

        <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <h2 className="text-lg font-medium">{t('housekeeping.today')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('housekeeping.todayBody')}</p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t('housekeeping.occupancy')}</dt>
              <dd className="mt-0.5 font-medium">{t(occupancyKey(room.occupancy))}</dd>
            </div>
            {room.guest ? (
              <div>
                <dt className="text-xs text-muted-foreground">{room.guest.name}</dt>
                <dd className="mt-0.5 font-medium">{lDateRange(room.guest.checkIn, room.guest.checkOut, locale)}</dd>
                {room.guest.reference ? (
                  <dd className="mt-1">
                    <Link href={`/admin/bookings/${room.guest.reference}`} className="text-muted-foreground hover:text-accent-strong">
                      {t('housekeeping.openBooking')} · {room.guest.reference}
                    </Link>
                  </dd>
                ) : null}
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <section className="mt-6 rounded-[18px] bg-card p-5 shadow-soft sm:p-6" aria-labelledby="cleaning-log-heading">
        <h2 id="cleaning-log-heading" className="text-lg font-medium">{t('housekeeping.cleaningLog')}</h2>
        {allEvents.length > 0 ? <CleaningLogFilters members={members} member={memberFilter} from={from} to={to} /> : null}
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('housekeeping.noEvents')}</p>
        ) : (
          <>
            <ol className="mt-4 divide-y divide-border">
              {shownEvents.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>{t(housekeepingStatusKey(event.status))} · {memberNames.get(event.memberId) ?? event.memberId} · {t('housekeeping.eventRoomLabel', { room: event.roomNumber })}
                  {event.note ? <span className="block text-muted-foreground">{event.note}</span> : null}</span>
                <span className="text-muted-foreground">{new Date(event.occurredAt).toLocaleString(locale)}</span>
                {event.photoData ? <a href={`/housekeeper/photo/${event.id}`} target="_blank" rel="noreferrer" className="underline">{t('housekeeping.photoLink')}</a> : null}
              </li>)}
            </ol>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={events.length}
              pageSize={pageSize}
              hrefFor={(next) => hrefFor(next, pageSize)}
              pageSizeHrefFor={(size) => hrefFor(1, size)}
            />
          </>
        )}
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/admin/front-desk?type=${room.unit.roomTypeId}`} className={pill('ghost')}>
          <TableCellsIcon className="size-4" aria-hidden="true" />
          {t('housekeeping.seeOnFrontDesk')}
        </Link>
        <Link href={`/admin/content/units/${room.unit.id}`} className={pill('ghost')}>
          <PencilSquareIcon className="size-4" aria-hidden="true" />
          {t('housekeeping.editInCms')}
        </Link>
      </div>
    </AdminPage>
  );
}
