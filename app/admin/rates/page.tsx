import type { Metadata } from 'next';
import Link from 'next/link';
import { addDays, format, parseISO } from 'date-fns';
import { EyeSlash } from '@phosphor-icons/react/dist/ssr';
import {
  catalogService,
  contentService,
  demoControl,
  DEMO_HOTEL_SLUG,
  hotelRepository,
} from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';
import { tag } from '@/lib/ui';
import { RoomStatusControl } from '@/components/admin/room-controls';
import { RatePriceForm } from '@/components/admin/operations/rate-price-form';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { updateBaseRateAction } from './actions';

export const metadata: Metadata = { title: 'Rates & availability — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

const NIGHTS = 7;

export default async function RatesPage() {
  const today = toIsoDate(new Date());
  const dates = Array.from({ length: NIGHTS }, (_, index) => toIsoDate(addDays(parseISO(today), index)));
  const windowEnd = toIsoDate(addDays(parseISO(today), NIGHTS));

  const hotel = await catalogService.getHotel(DEMO_HOTEL_SLUG);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const rows = await Promise.all(
    rooms.map(async (room) => {
      const [rates, override, availability] = await Promise.all([
        contentService.listRatesContent(room.id),
        demoControl.getRoomStatusOverride(room.id),
        hotelRepository.getAvailability(room.id, today, windowEnd),
      ]);
      return {
        room,
        rate: rates[0] ?? null,
        rateCount: rates.length,
        override,
        remaining: new Map(availability.map((night) => [night.date, night.remaining])),
      };
    }),
  );

  return (
    <AdminPage>
      <AdminPageHeader
        title="Rates & availability"
        description="Base rates per room type, rooms left for the next seven nights, and manual overrides."
      />
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        In production, rates and availability come from the PMS or channel manager and this page reads
        them back; seasonal and date-based pricing arrive with that integration. Here, a saved rate reprices
        the guest site immediately, and an override forces a room type&apos;s status for every night.
      </p>

      <div className="mt-8">
        <TableCard caption="Room types with base rate, rooms left per night, and availability override" className="min-w-[66rem]">
          <thead>
            <tr className="border-b border-border">
              <Th className="px-3">Room type</Th>
              <Th className="px-3">
                <span className="block">Nightly · OTA comparison</span>
                <span className="block text-xs">{hotel.currency}, base rate</span>
              </Th>
              {dates.map((date, index) => (
                <Th key={date} className="px-1.5 text-center text-xs">
                  <span className="block">{index === 0 ? 'Tonight' : format(parseISO(date), 'EEE')}</span>
                  <span className="block tabular-nums">{format(parseISO(date), 'd MMM')}</span>
                </Th>
              ))}
              <Th className="px-3">Override</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ room, rate, rateCount, override, remaining }) => (
              <tr key={room.id} className="border-b border-border last:border-b-0">
                <Td className="w-44 px-3 align-middle">
                  <Link href={`/admin/content/rooms/${room.id}`} className="font-medium hover:text-accent-strong">
                    {room.name}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {rate ? rate.name : 'No rate'}
                    {rateCount > 1 ? ` · ${rateCount} rates` : ''}
                    {room.hidden ? (
                      <span className={tag('py-0.5')}>
                        <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                        Hidden
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td className="px-3 align-middle">
                  {rate ? (
                    <RatePriceForm
                      action={updateBaseRateAction.bind(null, room.id, rate.id)}
                      version={rate.version}
                      idPrefix={`rate-${rate.id}`}
                      roomName={room.name}
                      currency={rate.currency}
                      nightlyPrice={rate.nightlyPrice}
                      otaComparisonPrice={rate.otaComparisonPrice}
                    />
                  ) : (
                    <Link href={`/admin/content/rooms/${room.id}`} className="text-sm text-muted-foreground hover:text-accent-strong">
                      Add a rate in the CMS
                    </Link>
                  )}
                </Td>
                {dates.map((date) => {
                  const left = remaining.get(date);
                  return (
                    <Td key={date} className="px-1.5 text-center align-middle tabular-nums">
                      {left === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : left === 0 ? (
                        <span className="font-medium text-danger">
                          0<span className="sr-only"> left, fully booked</span>
                        </span>
                      ) : (
                        <span>
                          {left}
                          <span className="sr-only"> left</span>
                        </span>
                      )}
                    </Td>
                  );
                })}
                <Td className="w-52 px-3 align-middle">
                  <RoomStatusControl roomTypeId={room.id} roomName={room.name} value={override ?? 'auto'} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      </div>
    </AdminPage>
  );
}
