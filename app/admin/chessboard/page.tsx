import type { Metadata } from 'next';
import Link from 'next/link';
import { addDays, format, parseISO } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { DEMO_HOTEL_SLUG, inventoryService } from '@/lib/application/container';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import { formatDateShort, formatNights } from '@/lib/formatting';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { ChessboardGrid } from '@/components/admin/chessboard/chessboard-grid';
import { ChessboardLegend } from '@/components/admin/chessboard/chessboard-legend';
import {
  chessboardHref,
  DEFAULT_WINDOW,
  WINDOW_OPTIONS,
} from '@/components/admin/chessboard/chessboard-shared';
import { RoomTypeSelect } from '@/components/admin/chessboard/room-type-select';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Chessboard — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function shift(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
}

function counted(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export default async function ChessboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = toIsoDate(new Date());
  const rawFrom = first(params.from);
  const from = isIsoDate(rawFrom) ? rawFrom : today;
  const rawDays = Number(first(params.days));
  const days = (WINDOW_OPTIONS as readonly number[]).includes(rawDays) ? rawDays : DEFAULT_WINDOW;

  const board = await inventoryService.getChessboard(DEMO_HOTEL_SLUG, from, days);
  const rawType = first(params.type);
  const type = rawType && board.groups.some((group) => group.roomTypeId === rawType) ? rawType : null;
  const groups = type ? board.groups.filter((group) => group.roomTypeId === type) : board.groups;

  const night = board.days[0];
  const percent = night && board.totalRooms > 0 ? Math.round((night.occupied / board.totalRooms) * 100) : 0;
  const when = from === today ? 'Tonight' : `On ${formatDateShort(from)}`;
  const lastNight = board.dates.at(-1) ?? from;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Chessboard"
        description="Every room, night by night: who is in it, what simulated demand holds, and what is closed to sale."
        actions={
          <Link href="/admin/bookings" className={pill('secondary')}>
            All bookings
          </Link>
        }
      />

      {night ? (
        <p className="mt-6 max-w-3xl text-base">
          {when} {night.occupied} of {board.totalRooms} rooms are occupied ({percent}%) —{' '}
          {counted(night.arrivals, 'arrival')}, {counted(night.departures, 'departure')}.{' '}
          <span className="text-muted-foreground">
            Occupancy counts simulated demand alongside real bookings.
          </span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={chessboardHref({ from: shift(from, -days), days, type })}
            aria-label={`Previous ${days} nights`}
            className={iconButton('light')}
          >
            <ChevronLeftIcon className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href={chessboardHref({ from: today, days, type })}
            aria-current={from === today ? 'true' : undefined}
            className={pill('secondary')}
          >
            Today
          </Link>
          <Link
            href={chessboardHref({ from: shift(from, days), days, type })}
            aria-label={`Next ${days} nights`}
            className={iconButton('light')}
          >
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </Link>
        </div>
        <p className="text-sm font-medium">
          {formatDateShort(from)} – {formatDateShort(lastNight)}
          <span className="font-normal text-muted-foreground"> · {formatNights(board.dates.length)}</span>
        </p>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <div
            role="group"
            aria-label="Nights shown"
            className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
          >
            {WINDOW_OPTIONS.map((option) => {
              const active = option === days;
              return (
                <Link
                  key={option}
                  href={chessboardHref({ from, days: option, type })}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors sm:min-h-9 sm:px-3',
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone',
                  )}
                >
                  {option} nights
                </Link>
              );
            })}
          </div>
          <RoomTypeSelect
            options={board.groups.map((group) => ({ id: group.roomTypeId, name: group.roomName }))}
            value={type}
            from={from}
            days={days}
          />
        </div>
      </div>

      <div className="mt-6">
        <ChessboardLegend />
      </div>

      <div className="mt-5">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
            <h2 className="text-display text-3xl">No rooms to show</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {type
                ? 'That room type has no rooms in this window.'
                : 'Add a room type and its rooms will appear here, night by night.'}
            </p>
            <Link
              href={type ? chessboardHref({ from, days, type: null }) : '/admin/content/rooms/new'}
              className={pill('primary')}
            >
              {type ? 'Show all room types' : 'Add a room type'}
            </Link>
          </div>
        ) : (
          <ChessboardGrid
            dates={board.dates}
            days={board.days}
            groups={groups}
            totalRooms={board.totalRooms}
            today={today}
          />
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Rooms are numbered from each room type&apos;s floor and view. In production the PMS owns room
        assignment; this board shows how the demo places each stay.
      </p>
    </AdminPage>
  );
}
