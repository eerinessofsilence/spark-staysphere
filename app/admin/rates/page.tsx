import type { Metadata } from 'next';
import Link from 'next/link';
import {
  catalogService,
  contentService,
  demoControl,
  DEMO_HOTEL_SLUG,
  hotelRepository,
} from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { DATE_FNS_LOCALES } from '@/lib/i18n/format';
import { pluralForm } from '@/lib/i18n/plural';
import { pill } from '@/lib/ui';
import { WINDOW_OPTIONS, MAX_CUSTOM_WINDOW } from '@/components/admin/front-desk/front-desk-shared';
import { DateWindowToolbar } from '@/components/admin/operations/date-window-toolbar';
import { RatesDateHeader } from '@/components/admin/rates/rates-date-header';
import { RatesSearchBox } from '@/components/admin/rates/rates-search-box';
import { RoomQuotaRow } from '@/components/admin/rates/room-quota-row';
import { buildDateWindow, ratesHref, roomRatesHref } from '@/components/admin/rates/rates-shared';
import { AddRoomRateButton } from '@/components/admin/content/add-room-rate-button';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createRateAction } from '@/app/admin/content/rooms/[id]/actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.roomRates')) };
}

const DEFAULT_WINDOW = 14;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The overview: one grid row per room type, quota only — a glance at who's
 * sold out and when. A row is the door into that room's own rates screen
 * (`/admin/rates/[id]`), where its rate plans and their prices actually
 * live; this page never shows a price, so it stays short even with many
 * room types and many rates each.
 */
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
  const hotel = await catalogService.getHotel(selectedSlug);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const canAddRate = selectedSlug === DEMO_HOTEL_SLUG;
  const allRows = await Promise.all(
    rooms.map(async (room) => {
      const [rateCount, override, availability] = await Promise.all([
        contentService.listRatesContent(room.id).then((rates) => rates.length),
        demoControl.getRoomStatusOverride(room.id),
        hotelRepository.getAvailability(room.id, from, windowEnd),
      ]);
      return {
        room,
        rateCount,
        override,
        remaining: new Map(availability.map((night) => [night.date, night.remaining])),
      };
    }),
  );
  const needle = q.toLowerCase();
  // The overview only ever names room types, so a rate's own name has to be
  // fetched separately to still match it — content-service reads are cheap
  // enough for a demo catalog this size, and it's the only way "garden
  // studio breakfast" (a rate's name) can find its room from here at all.
  const rows = needle
    ? (
        await Promise.all(
          allRows.map(async (row) => {
            if (row.room.name.toLowerCase().includes(needle)) return row;
            const rates = await contentService.listRatesContent(row.room.id);
            return rates.some((rate) => rate.name.toLowerCase().includes(needle)) ? row : null;
          }),
        )
      ).filter((row): row is (typeof allRows)[number] => row !== null)
    : allRows;

  const rateCountLabel = (count: number) =>
    pluralForm(locale, count, {
      one: t('rates.countOne', { count }),
      few: t('rates.countFew', { count }),
      many: t('rates.countMany', { count }),
      other: t('rates.countMany', { count }),
    });

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.roomRates')}
        actions={
          canAddRate ? (
            <AddRoomRateButton
              rooms={rows.map(({ room }) => ({ id: room.id, name: room.name }))}
              currency={hotel.currency}
              createRateAction={createRateAction}
            />
          ) : null
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

      <div className="mt-5">
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
              <RatesDateHeader dates={dates} columns={columns} dateFnsLocale={dateFnsLocale} t={t} />
              {rows.map(({ room, rateCount, override, remaining }) => (
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
                  <div className="sticky left-0 z-20 w-fit border-b border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
                    {rateCount === 0 ? t('rates.noRate') : rateCountLabel(rateCount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
