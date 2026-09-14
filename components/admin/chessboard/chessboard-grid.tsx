'use client';

import * as React from 'react';
import Link from 'next/link';
import { addDays, format, parseISO } from 'date-fns';
import { Prohibit, PushPin } from '@phosphor-icons/react/dist/ssr';
import type {
  ChessboardDay,
  ChessboardGroup,
  ChessboardRoom,
  ChessboardSegment,
} from '@/lib/application/inventory-service';
import { nightsBetween } from '@/lib/domain/pricing';
import {
  facadeLabels,
  formatDateRange,
  formatGuests,
  formatMoney,
  formatNights,
} from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { demandPattern } from './chessboard-shared';

interface ChessboardGridProps {
  dates: string[];
  days: ChessboardDay[];
  groups: ChessboardGroup[];
  totalRooms: number;
  today: string;
}

interface Selection {
  segment: ChessboardSegment;
  roomNumber: string;
  roomName: string;
}

const LABEL_WIDTH = '9rem';
const NIGHT_WIDTH = '2.75rem';

function isoPlus(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
}

function segmentRange(segment: ChessboardSegment, dates: string[]): { from: string; to: string } {
  if (segment.kind === 'booking') return { from: segment.checkIn, to: segment.checkOut };
  return { from: dates[segment.start]!, to: isoPlus(dates[segment.start]!, segment.span) };
}

function segmentLabel(segment: ChessboardSegment, dates: string[], roomNumber: string): string {
  if (segment.kind === 'booking') {
    return `Booking ${segment.reference}, ${segment.guestName}, ${formatDateRange(segment.checkIn, segment.checkOut)}, ${
      segment.chosenByGuest ? 'room chosen by guest' : 'room assigned automatically'
    }`;
  }
  const { from, to } = segmentRange(segment, dates);
  const what = segment.kind === 'demand' ? 'Simulated demand' : 'Closed to sale';
  return `${what}, room ${roomNumber}, ${formatDateRange(from, to)}`;
}

export function ChessboardGrid({ dates, days, groups, totalRooms, today }: ChessboardGridProps) {
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  const columns = `minmax(${LABEL_WIDTH}, ${LABEL_WIDTH}) repeat(${dates.length}, minmax(${NIGHT_WIDTH}, 1fr))`;
  const minWidth = `calc(${LABEL_WIDTH} + ${dates.length} * ${NIGHT_WIDTH})`;
  const weekends = React.useMemo(
    () => new Set(dates.map((date, index) => ([0, 6].includes(parseISO(date).getDay()) ? index : -1))),
    [dates],
  );

  const select = (segment: ChessboardSegment, room: ChessboardRoom, roomName: string) => {
    setSelection({ segment, roomNumber: room.number, roomName });
    setOpen(true);
  };

  return (
    <>
      <div className="relative overflow-x-auto rounded-[28px] bg-card shadow-soft contain-inline-size">
        <div style={{ minWidth }} className="text-sm">
          <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-20 flex items-end bg-card px-4 py-3 text-xs text-muted-foreground">
              Room
            </div>
            {dates.map((date, index) => {
              const isToday = date === today;
              const day = parseISO(date);
              return (
                <div
                  key={date}
                  className={cn(
                    'flex flex-col items-center justify-end border-l border-border py-2 text-xs',
                    weekends.has(index) && 'bg-stone/50',
                  )}
                >
                  <span className={cn('text-muted-foreground', isToday && 'font-semibold text-accent-strong')}>
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 flex items-center gap-1 text-sm font-medium tabular-nums',
                      isToday && 'text-accent-strong',
                    )}
                  >
                    {isToday ? <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /> : null}
                    {format(day, 'd')}
                  </span>
                  <span className="sr-only"> {format(day, 'MMMM')}</span>
                  {isToday ? <span className="sr-only">, today</span> : null}
                </div>
              );
            })}
          </div>

          <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-20 bg-card px-4 py-2 text-xs text-muted-foreground">Occupied</div>
            {days.map((day, index) => (
              <div
                key={day.date}
                title={`${day.occupied} of ${totalRooms} rooms`}
                className={cn(
                  'border-l border-border py-2 text-center text-xs font-medium tabular-nums',
                  weekends.has(index) && 'bg-stone/50',
                )}
              >
                {day.occupied}
                <span className="sr-only"> of {totalRooms} rooms occupied</span>
              </div>
            ))}
          </div>

          {groups.map((group) => (
            <div key={group.roomTypeId} role="group" aria-label={group.roomName}>
              <div className="border-b border-border bg-stone/40">
                <div className="sticky left-0 flex w-fit max-w-[calc(100vw-4rem)] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="font-medium">{group.roomName}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.rooms.length === 1 ? '1 room' : `${group.rooms.length} rooms`}
                  </span>
                  {group.hidden ? <span className={tag()}>Hidden from site</span> : null}
                  <Link
                    href={`/admin/content/rooms/${group.roomTypeId}`}
                    className="text-xs font-medium underline-offset-4 hover:text-accent-strong hover:underline"
                  >
                    Edit
                    <span className="sr-only"> {group.roomName}</span>
                  </Link>
                </div>
              </div>

              {group.rooms.map((room) => {
                const occupiedNights = room.segments.reduce((sum, segment) => sum + segment.span, 0);
                return (
                  <div
                    key={room.number}
                    role="group"
                    aria-label={`Room ${room.number}`}
                    className="grid min-h-14 border-b border-border"
                    style={{ gridTemplateColumns: columns }}
                  >
                    <div
                      className="sticky left-0 z-20 row-start-1 flex flex-col justify-center bg-card px-4 py-2"
                      style={{ gridColumn: 1 }}
                    >
                      <span className="font-medium tabular-nums">{room.number}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        Floor {room.floor} · {facadeLabels[room.facade]}
                      </span>
                      <span className="sr-only">
                        , free {dates.length - occupiedNights} of {dates.length} nights
                      </span>
                    </div>
                    {dates.map((date, index) => (
                      <div
                        key={date}
                        aria-hidden="true"
                        className={cn('row-start-1 border-l border-border', weekends.has(index) && 'bg-stone/50')}
                        style={{ gridColumn: index + 2 }}
                      />
                    ))}
                    {room.segments.map((segment) => (
                      <SegmentBar
                        key={`${segment.kind}-${segment.start}`}
                        segment={segment}
                        label={segmentLabel(segment, dates, room.number)}
                        onSelect={() => select(segment, room, group.roomName)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={
          selection?.segment.kind === 'booking'
            ? `Booking ${selection.segment.reference}`
            : selection?.segment.kind === 'closed'
              ? 'Closed to sale'
              : 'Simulated demand'
        }
      >
        {selection ? <SelectionDetail selection={selection} dates={dates} /> : null}
      </Modal>
    </>
  );
}

function SegmentBar({
  segment,
  label,
  onSelect,
}: {
  segment: ChessboardSegment;
  label: string;
  onSelect: () => void;
}) {
  const style: React.CSSProperties = {
    gridColumn: `${segment.start + 2} / span ${segment.span}`,
    gridRow: 1,
    ...(segment.kind === 'demand' ? demandPattern : {}),
  };

  const base =
    'relative z-10 mx-0.5 flex h-9 min-w-0 cursor-pointer items-center gap-1 self-center overflow-hidden rounded-full px-2.5 text-left text-xs font-medium transition-[filter] hover:brightness-95';

  if (segment.kind === 'booking') {
    const lastName = segment.guestName.split(' ').at(-1) ?? segment.guestName;
    const initials = segment.guestName
      .split(' ')
      .map((part) => part[0])
      .join('');
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        title={label}
        style={style}
        className={cn(
          base,
          'bg-primary text-primary-foreground',
          segment.continuesBefore && 'ml-0 rounded-l-none',
          segment.continuesAfter && 'mr-0 rounded-r-none',
        )}
      >
        {segment.chosenByGuest ? <PushPin weight="fill" className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        <span className="truncate">{segment.span >= 2 ? lastName : initials}</span>
      </button>
    );
  }

  if (segment.kind === 'closed') {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        title={label}
        style={style}
        className={cn(base, 'bg-danger/10 text-danger')}
      >
        <Prohibit weight="fill" className="size-3.5 shrink-0" aria-hidden="true" />
        {segment.span >= 2 ? <span className="truncate">Closed</span> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      title={label}
      style={style}
      className={cn(base, 'bg-stone text-muted-foreground')}
    >
      {segment.span >= 3 ? <span className="truncate">Demand</span> : null}
    </button>
  );
}

function SelectionDetail({ selection, dates }: { selection: Selection; dates: string[] }) {
  const { segment, roomNumber, roomName } = selection;

  if (segment.kind === 'booking') {
    return (
      <div>
        <p className="text-display text-3xl">{segment.guestName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{segment.reference}</p>
        <dl className="mt-5 grid gap-3 text-sm">
          <DetailRow label="Dates">
            {formatDateRange(segment.checkIn, segment.checkOut)}
            <span className="block font-normal text-muted-foreground">
              {formatNights(nightsBetween(segment.checkIn, segment.checkOut))}
            </span>
          </DetailRow>
          <DetailRow label="Guests">{formatGuests(segment.adults, segment.children)}</DetailRow>
          <DetailRow label="Room">
            Room {roomNumber}
            <span className="block font-normal text-muted-foreground">{roomName}</span>
          </DetailRow>
          <DetailRow label="Total">{formatMoney(segment.total, segment.currency)}</DetailRow>
        </dl>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          {segment.chosenByGuest ? (
            <>
              <PushPin weight="fill" className="size-4 text-foreground" aria-hidden="true" />
              Chosen by the guest on the floor plan
            </>
          ) : (
            'Assigned automatically'
          )}
        </p>
        <div className="mt-6">
          <Link href={`/admin/bookings/${segment.reference}`} className={pill('primary')}>
            Open booking
          </Link>
        </div>
      </div>
    );
  }

  const { from, to } = segmentRange(segment, dates);
  return (
    <div>
      <p className="text-display text-3xl">Room {roomNumber}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {roomName} · {formatDateRange(from, to)} · {formatNights(segment.span)}
      </p>
      {segment.kind === 'demand' ? (
        <p className="mt-5 text-sm leading-relaxed">
          Simulated demand — stands in for channel and walk-in bookings in this demo, not a real
          reservation. Guests see these nights as taken, the same way the catalog counts them.
        </p>
      ) : (
        <>
          <p className="mt-5 text-sm leading-relaxed">
            Closed by an availability override. Guests cannot book this room for these nights until
            the override is lifted.
          </p>
          <div className="mt-6">
            <Link href="/admin/rates" className={pill('secondary')}>
              Rates &amp; availability
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
