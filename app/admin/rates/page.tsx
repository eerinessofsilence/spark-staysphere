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
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { formatDate } from '@/lib/formatting';
import { tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { RoomStatusControl } from '@/components/admin/room-controls';
import { RatePriceForm } from '@/components/admin/operations/rate-price-form';
import { AddRoomRateButton } from '@/components/admin/content/add-room-rate-button';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createRateAction } from '@/app/admin/content/rooms/[id]/actions';
import { updateBaseRateAction } from './actions';

export const metadata: Metadata = { title: 'Room Rates — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

const NIGHTS = 7;

/**
 * Room type · price · seven nights · override. On a desk the one template lines every row up under
 * a shared head, like a table; on a phone each room type stacks and labels its own parts, so no
 * column ever hides off the edge of the screen.
 */
const columns = 'lg:grid-cols-[13rem_minmax(15rem,1fr)_minmax(0,21rem)_12rem]';

export default async function RatesPage() {
  const today = toIsoDate(new Date());
  const dates = Array.from({ length: NIGHTS }, (_, index) => toIsoDate(addDays(parseISO(today), index)));
  const windowEnd = toIsoDate(addDays(parseISO(today), NIGHTS));

  const selectedSlug = await getSelectedHotelSlug();
  const hotel = await catalogService.getHotel(selectedSlug);
  const rooms = await hotelRepository.listRooms(hotel.id);
  // The CMS (createRate/createRoom) only ever writes against the default hotel — see
  // content-service.ts's single bound `hotelSlug` — so the add-a-rate shortcut only
  // appears there; other hotels still edit an existing rate's price inline below.
  const canAddRate = selectedSlug === DEMO_HOTEL_SLUG;
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
        title="Room Rates"
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

      <section aria-label="Rates and availability by room type" className="mt-6 rounded-[18px] bg-card shadow-soft">
        <div
          aria-hidden="true"
          className={cn('hidden gap-4 border-b border-border px-5 py-3 text-sm text-muted-foreground lg:grid', columns)}
        >
          <span className="self-end">Room type</span>
          <span className="self-end">Nightly · booking-site price, {hotel.currency}</span>
          <span className="grid grid-cols-7 gap-1 text-center text-xs">
            {dates.map((date, index) => (
              <span key={date}>
                <span className="block">{index === 0 ? 'Tonight' : format(parseISO(date), 'EEE')}</span>
                <span className="block tabular-nums">{format(parseISO(date), 'd MMM')}</span>
              </span>
            ))}
          </span>
          <span className="self-end">Override</span>
        </div>

        <ul>
          {rows.map(({ room, rate, rateCount, override, remaining }) => (
            <li
              key={room.id}
              className={cn('grid gap-4 border-b border-border px-5 py-4 last:border-b-0 lg:items-center', columns)}
            >
              <div className="min-w-0">
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
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted-foreground lg:hidden" aria-hidden="true">
                  Nightly · booking-site price, {hotel.currency}
                </p>
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
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted-foreground lg:hidden" aria-hidden="true">
                  Rooms left, next seven nights
                </p>
                <ol
                  aria-label={`Rooms left for ${room.name}, next seven nights`}
                  className="grid grid-cols-7 gap-1 text-center text-sm tabular-nums"
                >
                  {dates.map((date) => {
                    const left = remaining.get(date);
                    return (
                      <li
                        key={date}
                        className={cn(
                          'rounded-xl py-1.5',
                          left === 0 ? 'bg-danger/10 font-medium text-danger' : 'bg-stone/50',
                        )}
                      >
                        <span className="block text-[11px] leading-tight text-muted-foreground lg:hidden" aria-hidden="true">
                          {format(parseISO(date), 'EEE')}
                        </span>
                        <span className="sr-only">{formatDate(date)}: </span>
                        {left === undefined ? '—' : left}
                        <span className="sr-only">{left === 0 ? ' left, fully booked' : ' left'}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted-foreground lg:hidden" aria-hidden="true">
                  Override
                </p>
                <RoomStatusControl roomTypeId={room.id} roomName={room.name} value={override ?? 'auto'} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AdminPage>
  );
}
