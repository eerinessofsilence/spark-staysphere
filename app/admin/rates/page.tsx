import type { Metadata } from 'next';
import Link from 'next/link';
import {
  catalogService,
  contentServiceFor,
  demoControl,
  hotelRepository,
} from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { DATE_FNS_LOCALES } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { WINDOW_OPTIONS, MAX_CUSTOM_WINDOW } from '@/components/admin/front-desk/front-desk-shared';
import { DateWindowToolbar } from '@/components/admin/operations/date-window-toolbar';
import { RatesDateHeader } from '@/components/admin/rates/rates-date-header';
import { RatePlanOverviewRow } from '@/components/admin/rates/rate-plan-overview-row';
import { RatesSearchBox } from '@/components/admin/rates/rates-search-box';
import { RoomQuotaRow } from '@/components/admin/rates/room-quota-row';
import { buildDateWindow, ratesHref, roomRatesHref } from '@/components/admin/rates/rates-shared';
import { AddRoomRateButton } from '@/components/admin/content/add-room-rate-button';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createRoomRateAction } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.roomRates')) };
}

const DEFAULT_WINDOW = 14;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Availability and each rate plan's base nightly price, aligned by date. */
export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const dateFnsLocale = DATE_FNS_LOCALES[locale];
  const params = await searchParams;
  const today = toIsoDate(new Date());
  const rawFrom = first(params.from);
  const from = isIsoDate(rawFrom) ? rawFrom : today;
  const rawDays = Number(first(params.days));
  const days = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= MAX_CUSTOM_WINDOW ? rawDays : DEFAULT_WINDOW;
  const q = first(params.q)?.trim() ?? '';
  const { dates, windowEnd, columns, minWidth } = buildDateWindow(from, days);

  const selectedSlug = await getSelectedHotelSlug();
  const contentService = contentServiceFor(selectedSlug);
  const hotel = await catalogService.getHotel(selectedSlug);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const allRows = await Promise.all(
    rooms.map(async (room) => {
      const [rates, override, availability] = await Promise.all([
        contentService.listRatesContent(room.id),
        demoControl.getRoomStatusOverride(room.id),
        hotelRepository.getAvailability(room.id, from, windowEnd),
      ]);
      return {
        room,
        rates,
        override,
        remaining: new Map(availability.map((night) => [night.date, night.remaining])),
      };
    }),
  );
  const needle = q.toLowerCase();
  const rows = needle
    ? allRows.filter((row) => row.room.name.toLowerCase().includes(needle) || row.rates.some((rate) => rate.name.toLowerCase().includes(needle)))
    : allRows;

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.roomRates')}
        actions={
          <AddRoomRateButton
            rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
            currency={hotel.currency}
            createRateAction={createRoomRateAction}
          />
        }
      />

      <DateWindowToolbar
        from={from}
        days={days}
        today={today}
        locale={locale}
        t={t}
        windowOptions={WINDOW_OPTIONS}
        hrefFor={(params) => ratesHref({ ...params, q })}
        before={<RatesSearchBox query={q} />}
      />

      <p className="mt-4 text-sm text-muted-foreground">{t('rates.basePriceNote', { currency: hotel.currency })}</p>

      <div className="mt-4">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
            <p className="font-medium">{q ? t('rates.noMatchQuery', { query: q }) : t('rates.noRate')}</p>
            {q ? (
              <Link href={ratesHref({ from, days, q: '' })} className={pill('secondary', 'mt-2')}>
                {t('rates.clearSearch')}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="relative overflow-x-auto rounded-[18px] bg-card shadow-soft contain-inline-size">
            <div style={{ minWidth }} className="text-sm">
              <RatesDateHeader dates={dates} columns={columns} dateFnsLocale={dateFnsLocale} t={t} label={t('rates.roomTypeAndRate')} />
              {rows.map(({ room, rates, override, remaining }) => (
                <div key={room.id} className="group">
                  <RoomQuotaRow
                    room={room}
                    override={override}
                    remaining={remaining}
                    dates={dates}
                    columns={columns}
                    locale={locale}
                    t={t}
                    linkTo={roomRatesHref(room.id, { from, days })}
                  />
                  {rates.length === 0 ? (
                    <div className="sticky left-0 z-20 w-fit border-b border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
                      {t('rates.noRate')}
                    </div>
                  ) : (
                    rates.map((rate) => (
                      <RatePlanOverviewRow
                        key={rate.id}
                        rate={rate}
                        dates={dates}
                        columns={columns}
                        href={roomRatesHref(room.id, { from, days })}
                        locale={locale}
                        t={t}
                      />
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
