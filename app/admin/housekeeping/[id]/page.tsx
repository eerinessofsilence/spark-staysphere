import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilSquareIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { housekeepingService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { housekeepingStatusKey, occupancyKey } from '@/lib/i18n/admin/housekeeping';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateRange, lFacade, lFloor, lRoomNumber } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { HousekeepingStatusForm } from '@/components/admin/housekeeping/housekeeping-status-form';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

async function loadRoom(id: string) {
  return housekeepingService.getRoom(await getSelectedHotelSlug(), decodeURIComponent(id), toIsoDate(new Date()));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, locale] = await Promise.all([params, getAdminLocale()]);
  const room = await loadRoom(id);
  return { title: adminPageTitle(adminT(locale), room ? lRoomNumber(room.unit.number, locale) : id) };
}

export default async function HousekeepingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale] = await Promise.all([params, getAdminLocale()]);
  const t = adminT(locale);
  const room = await loadRoom(id);
  if (!room) notFound();
  const events = await housekeepingService.listEvents(await getSelectedHotelSlug(), room.unit.id);

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
        {events.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('housekeeping.noEvents')}</p> : (
          <ol className="mt-4 divide-y divide-border">
            {events.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span>{t(housekeepingStatusKey(event.status))} · {event.memberId} · {t('housekeeping.eventRoomLabel', { room: event.roomNumber })}
                {event.note ? <span className="block text-muted-foreground">{event.note}</span> : null}</span>
              <span className="text-muted-foreground">{new Date(event.occurredAt).toLocaleString(locale)}</span>
              {event.photoData ? <a href={`/housekeeper/photo/${event.id}`} target="_blank" rel="noreferrer" className="underline">{t('housekeeping.photoLink')}</a> : null}
            </li>)}
          </ol>
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
