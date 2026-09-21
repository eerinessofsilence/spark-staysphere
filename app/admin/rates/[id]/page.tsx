import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalogService, contentService, demoControl, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { DATE_FNS_LOCALES } from '@/lib/i18n/format';
import { WINDOW_OPTIONS, MAX_CUSTOM_WINDOW } from '@/components/admin/front-desk/front-desk-shared';
import { DateWindowToolbar } from '@/components/admin/operations/date-window-toolbar';
import { RatePlanRow } from '@/components/admin/rates/rate-plan-row';
import { RatesDateHeader } from '@/components/admin/rates/rates-date-header';
import { RoomQuotaRow } from '@/components/admin/rates/room-quota-row';
import { buildDateWindow, roomRatesHref } from '@/components/admin/rates/rates-shared';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { updateBaseRateAction } from '../actions';

export const dynamic = 'force-dynamic';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loadRoom(id: string) {
  const selectedSlug = await getSelectedHotelSlug();
  const hotel = await catalogService.getHotel(selectedSlug);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const room = rooms.find((candidate) => candidate.id === id);
  return room ? { room, hotel } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = adminT(await getAdminLocale());
  const found = await loadRoom(id);
  return { title: adminPageTitle(t, found?.room.name ?? t('nav.roomRates')) };
}

const DEFAULT_WINDOW = 14;

/**
 * One room type's own rates screen: its quota, and every one of its rate
 * plans with a real, saving price form beside a flat rate repeated across
 * the shown nights (see `RatePlanRow`'s own doc comment on why it repeats
 * rather than invents a per-night number). Opened from its row on the
 * overview (`/admin/rates`), which never shows a price itself.
 */
export default async function RoomRatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const found = await loadRoom(id);
  if (!found) notFound();
  const { room, hotel } = found;

  const locale = await getAdminLocale();
  const t = adminT(locale);
  const dateFnsLocale = DATE_FNS_LOCALES[locale];
  const query = await searchParams;
  const today = toIsoDate(new Date());
  const rawFrom = first(query.from);
  const from = isIsoDate(rawFrom) ? rawFrom : today;
  const rawDays = Number(first(query.days));
  const days = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= MAX_CUSTOM_WINDOW ? rawDays : DEFAULT_WINDOW;
  const { dates, windowEnd, columns, minWidth } = buildDateWindow(from, days);

  const [rates, override, availability] = await Promise.all([
    contentService.listRatesContent(room.id),
    demoControl.getRoomStatusOverride(room.id),
    hotelRepository.getAvailability(room.id, from, windowEnd),
  ]);
  const remaining = new Map(availability.map((night) => [night.date, night.remaining]));

  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.roomRates'), href: '/admin/rates' }]}
        title={room.name}
        description={hotel.currency}
      />

      <DateWindowToolbar
        from={from}
        days={days}
        today={today}
        locale={locale}
        t={t}
        windowOptions={WINDOW_OPTIONS}
        hrefFor={(params) => roomRatesHref(room.id, params)}
      />

      <div className="mt-5 overflow-x-auto rounded-[18px] bg-card shadow-soft contain-inline-size">
        <div style={{ minWidth }} className="text-sm">
          <RatesDateHeader dates={dates} columns={columns} dateFnsLocale={dateFnsLocale} t={t} />
          <RoomQuotaRow room={room} override={override} remaining={remaining} dates={dates} columns={columns} locale={locale} t={t} />
          {rates.length === 0 ? (
            <div className="grid" style={{ gridTemplateColumns: columns }}>
              <div className="sticky left-0 z-20 bg-card px-4 py-3">
                <Link href={`/admin/content/rooms/${room.id}`} className="text-sm text-muted-foreground hover:text-accent-strong">
                  {t('rates.addInCms')}
                </Link>
              </div>
            </div>
          ) : (
            rates.map((rate) => (
              <RatePlanRow
                key={rate.id}
                rate={rate}
                roomName={room.name}
                dates={dates}
                columns={columns}
                updateAction={updateBaseRateAction.bind(null, room.id, rate.id)}
                t={t}
              />
            ))
          )}
        </div>
      </div>
    </AdminPage>
  );
}
