import Link from 'next/link';
import { catalogService, hotelRepository, holidayRateAdvisor } from '@/lib/application/container';
import { hotelCountryCode, hotelToday, hotelWeekendDays } from '@/lib/application/holiday-rate-advisor';
import { buildRateRecommendations, type RateRoomInput } from '@/lib/application/rate-recommendations';
import { addIsoDays } from '@/lib/domain/dates';
import { lDateShort, lMoney } from '@/lib/i18n/format';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { adminT } from '@/lib/i18n/admin/translate';
import { pill } from '@/lib/ui';

/** Read-only rate review for the same nights as the visible matrix. */
export async function RateInsights({ hotelSlug, rows, from, days, locale }: {
  hotelSlug: string;
  rows: Omit<RateRoomInput, 'capacity'>[];
  from: string;
  days: number;
  locale: AdminLocale;
}) {
  const t = adminT(locale);
  try {
    const hotel = await catalogService.getHotel(hotelSlug);
    const today = hotelToday(new Date(), hotel.timezone);
    const [units, bookings, holidays] = await Promise.all([
      hotelRepository.listPhysicalRooms(hotel.id),
      hotelRepository.listBookings({ hotelId: hotel.id }),
      holidayRateAdvisor.allWithin(hotel, from, addIsoDays(from, days - 1), new Date()),
    ]);
    const result = buildRateRecommendations({
      today, from, days, includeWeekdays: true, limit: 8,
      currency: hotel.currency, bookings,
      holidays: holidays.status === 'ready'
        ? holidays.holidays.map((day) => ({ date: day.date, name: day.holidayName })) : [],
      weekendDays: hotelWeekendDays(hotelCountryCode(hotel.location)),
      rooms: rows.map((row) => ({ ...row, capacity: units.filter((unit) => unit.roomTypeId === row.room.id).length })),
    });
    if (result.status !== 'ready') throw new Error('Rate advice unavailable');
    return (
      <section aria-labelledby="rate-insights-title" className="mt-5 rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="rate-insights-title" className="text-display text-lg">{t('assistant.rate.gridHeading')}</h2>
          <p className="text-xs text-muted-foreground">{t('assistant.rate.gridManual')}</p>
        </div>
        {result.recommendations.length ? (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {result.recommendations.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">{item.roomName} · {item.rateName} · {lDateShort(item.date, locale)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('assistant.rate.gridDemand', { booked: item.booked, capacity: item.capacity })}
                    {item.baselinePercent !== null ? ` · ${t('assistant.rate.gridBaseline', { percent: item.baselinePercent })}` : ''}
                    {item.holidayName ? ` · ${item.holidayName}` : ''}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums">
                  <span className="font-semibold text-accent-strong">{item.changePercent > 0 ? '+' : ''}{item.changePercent}%</span>
                  <span className="ml-2 text-muted-foreground">{lMoney(item.currentPrice, result.currency, locale)} → {lMoney(item.suggestedPrice, result.currency, locale)}</span>
                </p>
                <Link href={item.href} className={pill('secondary', 'min-h-10 shrink-0 px-4 text-xs')}>
                  {t('assistant.rate.openDate')}
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">{t('assistant.rate.gridNone')}</p>}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('assistant.rate.gridMethod')}</p>
      </section>
    );
  } catch {
    return <p role="status" className="mt-5 rounded-[18px] border border-border bg-card p-4 text-sm text-muted-foreground">{t('assistant.rate.unavailable')}</p>;
  }
}
