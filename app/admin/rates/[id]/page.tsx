import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { catalogService, contentService, demoControl, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import { addIsoDays } from '@/lib/domain/dates';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { DATE_FNS_LOCALES, lDateShort, lNights } from '@/lib/i18n/format';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { WINDOW_OPTIONS, MAX_CUSTOM_WINDOW } from '@/components/admin/front-desk/front-desk-shared';
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
  const lastNight = dates.at(-1) ?? from;
  const nights = lNights(days, locale);

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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={roomRatesHref(room.id, { from: addIsoDays(from, -days), days })}
            aria-label={t('frontDesk.previousNights', { nights })}
            className={iconButton('light')}
          >
            <ChevronLeftIcon className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href={roomRatesHref(room.id, { from: today, days })}
            aria-current={from === today ? 'true' : undefined}
            className={pill('secondary')}
          >
            {t('frontDesk.today')}
          </Link>
          <Link
            href={roomRatesHref(room.id, { from: addIsoDays(from, days), days })}
            aria-label={t('frontDesk.nextNights', { nights })}
            className={iconButton('light')}
          >
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {WINDOW_OPTIONS.map((option) => (
            <Link
              key={option}
              href={roomRatesHref(room.id, { from, days: option })}
              aria-current={option === days ? 'page' : undefined}
              className={cn(
                'flex min-h-8 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors',
                option === days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone hover:text-foreground',
              )}
            >
              {lNights(option, locale)}
            </Link>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {t('rates.dates', { from: lDateShort(from, locale), to: lDateShort(lastNight, locale) })}
        </p>
      </div>

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
