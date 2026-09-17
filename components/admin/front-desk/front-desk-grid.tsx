'use client';

import * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Prohibit, PushPin } from '@phosphor-icons/react/dist/ssr';
import type {
  FrontDeskDay,
  FrontDeskGroup,
  FrontDeskRoom,
  FrontDeskSegment,
} from '@/lib/application/inventory-service';
import { addIsoDays } from '@/lib/domain/dates';
import { nightsBetween } from '@/lib/domain/pricing';
import {
  facadeLabels,
  formatDateRange,
  formatMoney,
} from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { Modal } from '@/components/site/modal';
import { demandPattern } from './front-desk-shared';

interface FrontDeskGridProps {
  dates: string[];
  days: FrontDeskDay[];
  groups: FrontDeskGroup[];
  totalRooms: number;
  today: string;
}

interface Selection {
  segment: FrontDeskSegment;
  roomNumber: string;
  roomName: string;
  photo: FrontDeskGroup['photo'];
}

const LABEL_WIDTH = '9rem';
const NIGHT_WIDTH = '2.75rem';

function segmentRange(segment: FrontDeskSegment, dates: string[]): { from: string; to: string } {
  if (segment.kind === 'booking') return { from: segment.checkIn, to: segment.checkOut };
  return { from: dates[segment.start]!, to: addIsoDays(dates[segment.start]!, segment.span) };
}

function segmentLabel(segment: FrontDeskSegment, dates: string[], roomNumber: string): string {
  if (segment.kind === 'booking') {
    return `Booking ${segment.reference}, ${segment.guestName}, ${formatDateRange(segment.checkIn, segment.checkOut)}, ${
      segment.chosenByGuest ? 'room chosen by guest' : 'room assigned automatically'
    }`;
  }
  const { from, to } = segmentRange(segment, dates);
  const what = segment.kind === 'demand' ? 'Simulated demand' : 'Closed to sale';
  return `${what}, room ${roomNumber}, ${formatDateRange(from, to)}`;
}

export function FrontDeskGrid({ dates, days, groups, totalRooms, today }: FrontDeskGridProps) {
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  const columns = `minmax(${LABEL_WIDTH}, ${LABEL_WIDTH}) repeat(${dates.length}, minmax(${NIGHT_WIDTH}, 1fr))`;
  const minWidth = `calc(${LABEL_WIDTH} + ${dates.length} * ${NIGHT_WIDTH})`;
  const weekends = React.useMemo(
    () => new Set(dates.map((date, index) => ([0, 6].includes(parseISO(date).getDay()) ? index : -1))),
    [dates],
  );

  const select = (segment: FrontDeskSegment, room: FrontDeskRoom, group: FrontDeskGroup) => {
    setSelection({ segment, roomNumber: room.number, roomName: group.roomName, photo: group.photo });
    setOpen(true);
  };

  return (
    <>
      <div className="relative overflow-x-auto rounded-[18px] bg-card shadow-soft contain-inline-size">
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
                        onSelect={() => select(segment, room, group)}
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
  segment: FrontDeskSegment;
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
  const { segment, roomNumber, roomName, photo } = selection;

  const header = (
    <div className="flex items-start gap-4">
      {photo ? (
        <img
          src={photo.url}
          alt={roomName}
          width={photo.width}
          height={photo.height}
          className="size-20 shrink-0 rounded-xl object-cover sm:size-24"
        />
      ) : null}
      <div className="min-w-0">
        <p className="text-display text-2xl tabular-nums">Room {roomNumber}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{roomName}</p>
      </div>
    </div>
  );

  if (segment.kind === 'closed') {
    const { from, to } = segmentRange(segment, dates);
    return (
      <div>
        {header}
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <Field label="Dates" wide>
            {formatDateRange(from, to)}
          </Field>
          <Field label="Nights">{segment.span}</Field>
        </dl>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          Closed by an availability override. Guests cannot book this room for these nights until the
          override is lifted.
        </p>
        <div className="mt-6">
          <Link href="/admin/rates" className={pill('secondary')}>
            Rates &amp; availability
          </Link>
        </div>
      </div>
    );
  }

  const nights = nightsBetween(segment.checkIn, segment.checkOut);
  const balance = Math.max(0, segment.total - segment.paid);

  return (
    <div>
      {header}

      <dl className="mt-5 grid grid-cols-3 gap-x-4 gap-y-4 text-sm">
        <Field label="Main guest" wide>
          {segment.guestName}
        </Field>
        {segment.kind === 'booking' ? (
          <Field label="Booking #">
            <Link href={`/admin/bookings/${segment.reference}`} className="hover:text-accent-strong">
              {segment.reference}
            </Link>
          </Field>
        ) : (
          <Field label="Channel">{segment.channel}</Field>
        )}

        <Field label="Dates of stay" wide>
          {formatDateRange(segment.checkIn, segment.checkOut)}
        </Field>
        <Field label="Nights">{nights}</Field>

        <Field label="Room rate">{segment.ratePlanName}</Field>
        <Field label="Meals">{segment.breakfastIncluded ? 'Breakfast' : 'No meals'}</Field>
        <Field label="Guests">
          {segment.adults} {segment.adults === 1 ? 'adult' : 'adults'}
          {segment.children > 0 ? (
            <span className="block font-normal text-muted-foreground">
              {segment.children} {segment.children === 1 ? 'child' : 'children'}
            </span>
          ) : null}
        </Field>

        <Field label="Check-in">{segment.checkInTime}</Field>
        <Field label="Check-out">
          {segment.checkOutTime}
          {segment.checkOutTime !== '11:00' ? (
            <span className="block font-normal text-muted-foreground">Late check-out</span>
          ) : null}
        </Field>
        {segment.kind === 'booking' ? (
          <Field label="Assigned">
            {segment.chosenByGuest ? (
              <span className="inline-flex items-center gap-1">
                <PushPin weight="fill" className="size-3.5" aria-hidden="true" />
                By guest
              </span>
            ) : (
              'Automatically'
            )}
          </Field>
        ) : null}
      </dl>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Amount label="Amount" value={formatMoney(segment.total, segment.currency)} />
        <Amount label="Paid" value={formatMoney(segment.paid, segment.currency)} />
        <Amount
          label="Balance"
          value={formatMoney(balance, segment.currency)}
          tone={balance > 0 ? 'due' : 'settled'}
        />
      </div>

      {segment.kind === 'booking' ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {segment.guestEmail}
            {segment.guestPhone ? <span className="block">{segment.guestPhone}</span> : null}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <BookingStatusBadge status={segment.status} />
            <Link href={`/admin/bookings/${segment.reference}`} className={pill('primary')}>
              Booking details
            </Link>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-stone/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Simulated demand — stands in for channel and walk-in bookings in this demo, not a real
          reservation. Guests see these nights as taken, the same way the catalog counts them.
        </p>
      )}
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{children}</dd>
    </div>
  );
}

function Amount({ label, value, tone }: { label: string; value: string; tone?: 'due' | 'settled' }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border px-3 py-2',
        tone === 'settled'
          ? 'border-success/40 bg-success/5'
          : tone === 'due'
            ? 'border-warning/40 bg-warning/5'
            : 'border-border bg-stone/40',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
