import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  catalogService,
  contentServiceFor,
  DEMO_HOTEL_SLUG,
  demoControl,
  guestAppUrl,
  hotelRepository,
} from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { DATE_FNS_LOCALES } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { WINDOW_OPTIONS, MAX_CUSTOM_WINDOW } from '@/components/admin/front-desk/front-desk-shared';
import { DateWindowToolbar } from '@/components/admin/operations/date-window-toolbar';
import { RatesDateHeader } from '@/components/admin/rates/rates-date-header';
import { StickyRatesGrid } from '@/components/admin/rates/sticky-rates-grid';
import { RatePlanOverviewRow } from '@/components/admin/rates/rate-plan-overview-row';
import { RateStayRulesRows } from '@/components/admin/rates/rate-stay-rules-rows';
import { HolidayRateSection } from '@/components/admin/rates/holiday-rate-section';
import { RatesSearchBox } from '@/components/admin/rates/rates-search-box';
import { RateInsights } from '@/components/admin/rates/rate-insights';
import { RoomQuotaRow } from '@/components/admin/rates/room-quota-row';
import { buildDateWindow, holidayRatesHref, ratesHref, roomRatesHref } from '@/components/admin/rates/rates-shared';
import { AddRoomRateButton } from '@/components/admin/content/add-room-rate-button';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createRoomRateAction, updateDateRateAction, updateDateRateRangeAction, updateRateCloseoutAction } from './actions';

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
  const activeTab = first(params.tab) === 'holidays' ? 'holidays' : 'base';
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
  const rows = (needle
    ? allRows.filter((row) => row.room.name.toLowerCase().includes(needle) || row.rates.some((rate) => rate.name.toLowerCase().includes(needle)))
    : [...allRows]);
  // Sellable, configured room types are the daily task; hidden or unpriced
  // types stay reachable without pushing the working rate matrix offscreen.
  rows.sort((left, right) => Number(Boolean(left.room.hidden || !left.rates.length)) - Number(Boolean(right.room.hidden || !right.rates.length)));

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.roomRates')}
        actions={activeTab === 'base' ? (
          <AddRoomRateButton
            rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
            currency={hotel.currency}
            createRateAction={createRoomRateAction}
          />
        ) : undefined}
      />

      <nav aria-label={t('nav.roomRates')} className="mt-6 flex w-fit max-w-full gap-1 rounded-full border border-border bg-card p-1">
        {([
          { key: 'base', label: t('rates.tab.base'), href: ratesHref({ from, days, q }) },
          { key: 'holidays', label: t('rates.tab.holidays'), href: holidayRatesHref({ from, days }) },
        ] as const).map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            aria-current={activeTab === key ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-5',
              activeTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone hover:text-foreground',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <DateWindowToolbar
        from={from}
        days={days}
        today={today}
        locale={locale}
        t={t}
        windowOptions={WINDOW_OPTIONS}
        hrefFor={(params) => activeTab === 'holidays' ? holidayRatesHref(params) : ratesHref({ ...params, q })}
        before={activeTab === 'base' ? <RatesSearchBox query={q} suggestions={allRows.flatMap((row) => [
          { value: row.room.name, label: row.room.name },
          ...row.rates.map((rate) => ({ value: rate.name, label: rate.name, detail: row.room.name })),
        ])} /> : undefined}
      />

      {activeTab === 'holidays' ? (
        <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">{t('rates.holiday.loading')}</p>}>
          <HolidayRateSection hotel={hotel} rows={allRows.map(({ room, rates, override }) => ({ room, rates, override }))} from={from} days={days} />
        </Suspense>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">{t('rates.basePriceNote', { currency: hotel.currency })}</p>
          <Suspense fallback={<p className="mt-5 text-sm text-muted-foreground">{t('assistant.rate.checking')}</p>}>
            <RateInsights
              hotelSlug={selectedSlug}
              rows={rows.map(({ room, rates, override }) => ({ room, rates, override }))}
              from={from}
              days={days}
              locale={locale}
            />
          </Suspense>

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
          <StickyRatesGrid
            minWidth={minWidth}
            header={<RatesDateHeader dates={dates} columns={columns} dateFnsLocale={dateFnsLocale} t={t} label={t('rates.roomTypeAndRate')} today={today} />}
          >
              {rows.map(({ room, rates, remaining }) => {
                const content = (
                  <>
                    {rates.length === 0 ? (
                      <div className="sticky left-0 z-20 w-fit border-b border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
                        {t('rates.noRate')}
                      </div>
                    ) : (
                      rates.map((rate, index) => (
                        <div key={rate.id}>
                          <RatePlanOverviewRow
                            rate={rate}
                            dates={dates}
                            columns={columns}
                            href={roomRatesHref(room.id, { from, days })}
                            updateDateAction={updateDateRateAction.bind(null, room.id, rate.id)}
                            updateRangeAction={updateDateRateRangeAction.bind(null, room.id, rate.id)}
                            previewRoomSlug={selectedSlug === DEMO_HOTEL_SLUG && !room.hidden && index === 0 ? room.slug : undefined}
                            guestBaseUrl={guestAppUrl('/') ?? undefined}
                            locale={locale}
                            today={today}
                          />
                          <RateStayRulesRows
                            rate={rate}
                            dates={dates}
                            columns={columns}
                            href={roomRatesHref(room.id, { from, days })}
                            action={updateRateCloseoutAction.bind(null, room.id, rate.id)}
                            t={t}
                            today={today}
                          />
                        </div>
                      ))
                    )}
                  </>
                );
                const inactive = (room.hidden || rates.length === 0) && !needle;
                return (
                  <details key={room.id} data-inactive-rate-room={inactive ? '' : undefined} data-rate-room={inactive ? undefined : ''} open={!inactive} className="group/room border-b border-border">
                    <RoomQuotaRow room={room} remaining={remaining} dates={dates} columns={columns} locale={locale} t={t} today={today} />
                    {content}
                  </details>
                );
              })}
          </StickyRatesGrid>
        )}
          </div>
        </>
      )}
    </AdminPage>
  );
}
