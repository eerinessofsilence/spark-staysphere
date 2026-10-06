import Link from 'next/link';
import { holidayRateAdvisor, hotelRepository } from '@/lib/application/container';
import { holidayRoomSignals } from '@/lib/application/holiday-rate-insight';
import { addIsoDays } from '@/lib/domain/dates';
import type { Hotel, RatePlan, RoomStatus, RoomType } from '@/lib/domain/schemas';
import { lDate, lMoney } from '@/lib/i18n/format';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT } from '@/lib/i18n/admin/translate';
import { pill } from '@/lib/ui';
import { ratesHref, roomRatesHref } from './rates-shared';

type RoomRow = { room: RoomType; rates: RatePlan[]; override: RoomStatus | null };

/** The holiday signal beside the real rates grid; it never writes prices. */
export async function HolidayRateSection({ hotel, rows, from, days }: { hotel: Hotel; rows: RoomRow[]; from: string; days: number }) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const now = new Date();
  const selected = await holidayRateAdvisor.within(hotel, from, addIsoDays(from, days - 1), now);
  const advice = selected.status === 'none' ? await holidayRateAdvisor.next(hotel, now) : selected;
  if (advice.status === 'none') {
    return <p className="mt-6 rounded-[18px] border border-border bg-card p-6 text-sm text-muted-foreground">{t('rates.holiday.none')}</p>;
  }
  if (advice.status !== 'ready') {
    return <p className="mt-4 text-xs text-muted-foreground">{t(advice.status === 'unknown_country' ? 'rates.holiday.unknownCountry' : 'rates.holiday.unavailable')}</p>;
  }

  const units = await hotelRepository.listPhysicalRooms(hotel.id);
  const bookings = await hotelRepository.listBookings({ hotelId: hotel.id });
  const inputs = await Promise.all(rows.map(async ({ room, rates, override }) => {
    const capacity = units.filter((unit) => unit.roomTypeId === room.id).length;
    const availability = await hotelRepository.getAvailability(room.id, advice.date, addIsoDays(advice.date, 1));
    return {
      room, rates, override, capacity,
      remaining: availability.find((night) => night.date === advice.date)?.remaining ?? null,
      confirmedBookings: bookings.filter((booking) => booking.status === 'confirmed' && booking.roomTypeId === room.id && booking.checkIn <= advice.date && advice.date < booking.checkOut).length,
    };
  }));
  const signals = holidayRoomSignals(inputs).filter((row) => !row.room.hidden && row.capacity > 0 && row.rates.length > 0);
  const totalCapacity = signals.filter((row) => row.remaining !== null).reduce((sum, row) => sum + row.capacity, 0);
  const totalRemaining = signals.reduce((sum, row) => sum + (row.remaining ?? 0), 0);
  const flagged = signals.filter((row) => row.reviewIncrease).length;
  const country = new Intl.DisplayNames([locale], { type: 'region' }).of(advice.countryCode) ?? advice.countryName;

  return (
    <section aria-labelledby="holiday-rates-heading" className="mt-6 rounded-[18px] border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="holiday-rates-heading" className="text-display text-xl">{t('rates.holiday.heading')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{advice.holidayName} · {lDate(advice.date, locale)} · {country}</p>
        </div>
        <Link href={ratesHref({ from: advice.date, days: 7 })} className={pill('secondary', 'min-h-9 px-4 text-xs')}>
          {t('rates.holiday.viewWeek')}
        </Link>
      </div>

      {totalCapacity > 0 ? (
        <p className="mt-5 text-sm">
          {t('rates.holiday.summary', { remaining: totalRemaining, capacity: totalCapacity, flagged })}
        </p>
      ) : <p className="mt-5 text-sm text-muted-foreground">{t('rates.holiday.noRooms')}</p>}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('rates.holiday.method')}</p>

      {signals.length > 0 ? <div className="mt-5 divide-y divide-border border-t border-border">
        {signals.map((signal) => (
          <div key={signal.room.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">{signal.room.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t('rates.holiday.roomStats', {
                  remaining: signal.remaining ?? '—',
                  capacity: signal.capacity,
                  bookings: signal.confirmedBookings,
                  price: signal.lowestBasePrice === null ? '—' : lMoney(signal.lowestBasePrice, hotel.currency, locale),
                })}
              </p>
              <p className="mt-1 text-xs font-medium text-accent-strong">
                {t(signal.override ? 'rates.holiday.manual' : signal.reviewIncrease ? 'rates.holiday.increase' : 'rates.holiday.monitor')}
              </p>
            </div>
            <Link href={roomRatesHref(signal.room.id, { from: advice.date, days: 7 })} className={pill('secondary', 'min-h-9 px-4 text-xs')}>
              {t('rates.holiday.reviewRate')}
            </Link>
          </div>
        ))}
      </div> : null}
    </section>
  );
}
