'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ChevronRightIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle, Clock, Prohibit, PushPin } from '@phosphor-icons/react/dist/ssr';
import { createFrontDeskBookingAction, quoteFrontDeskBookingAction, type FrontDeskQuoteResult } from '@/app/admin/front-desk/actions';
import type {
  FrontDeskDay,
  FrontDeskGroup,
  FrontDeskRoom,
  FrontDeskSegment,
} from '@/lib/application/inventory-service';
import { addIsoDays } from '@/lib/domain/dates';
import type { PaymentMethod, StayState } from '@/lib/domain/schemas';
import { nightsBetween } from '@/lib/domain/pricing';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { DATE_FNS_LOCALES, lDateRange, lDateShort, lFacade, lFloor, lGuests, lMoney, lNights, lRoomCount, lRoomNumber } from '@/lib/i18n/format';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { StayStateMenu } from '@/components/admin/operations/stay-state-menu';
import { toast } from '@/components/admin/shell/toast';
import { emptyGuestParty, GuestPartyFields, PaymentMethodField, PriceFooter, type GuestParty } from './booking-form-fields';
import { STAY_STATUS_KEY } from './front-desk-legend';
import { stayStatus, stayStatusMeta, unavailablePattern } from './front-desk-shared';

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

/** A dragged range on one room's row, waiting on the create-booking form. */
interface BookingDraft {
  roomSlug: string;
  roomName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
}

const LABEL_WIDTH = '9rem';
const NIGHT_WIDTH = '2.75rem';

function segmentRange(segment: FrontDeskSegment, dates: string[]): { from: string; to: string } {
  if (segment.kind === 'booking') return { from: segment.checkIn, to: segment.checkOut };
  return { from: dates[segment.start]!, to: addIsoDays(dates[segment.start]!, segment.span) };
}

function segmentLabel(
  segment: FrontDeskSegment,
  dates: string[],
  roomNumber: string,
  today: string,
  t: AdminT,
  locale: AdminLocale,
): string {
  const room = lRoomNumber(roomNumber, locale);
  if (segment.kind === 'closed') {
    const { from, to } = segmentRange(segment, dates);
    return t('frontDesk.closedLabel', { room, dates: lDateRange(from, to, locale) });
  }
  const stay = {
    status: t(
      STAY_STATUS_KEY[
        stayStatus(segment.checkIn, segment.checkOut, today, segment.kind === 'booking' ? segment.stayState : undefined)
      ],
    ),
    guest: segment.guestName,
    room,
    dates: lDateRange(segment.checkIn, segment.checkOut, locale),
  };
  if (segment.kind === 'demand') return t('frontDesk.demandLabel', stay);
  return t('frontDesk.bookingLabel', {
    ...stay,
    reference: segment.reference,
    assignment: segment.chosenByGuest ? t('frontDesk.assignedByGuest') : t('frontDesk.assignedAuto'),
  });
}

export function FrontDeskGrid({ dates, days, groups, totalRooms, today }: FrontDeskGridProps) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const dateFns = DATE_FNS_LOCALES[locale];
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const [draft, setDraft] = React.useState<BookingDraft | null>(null);
  const [draftOpen, setDraftOpen] = React.useState(false);
  const closeDraft = React.useCallback(() => setDraftOpen(false), []);
  // Collapsed by room-type id rather than an allow-list, so a room type added
  // after the page loaded (a fresh CMS room type, another day's fetch) opens
  // expanded by default instead of silently starting hidden.
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const toggleGroup = (roomTypeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(roomTypeId)) next.delete(roomTypeId);
      else next.add(roomTypeId);
      return next;
    });
  };

  const columns = `minmax(${LABEL_WIDTH}, ${LABEL_WIDTH}) repeat(${dates.length}, minmax(${NIGHT_WIDTH}, 1fr))`;
  const minWidth = `calc(${LABEL_WIDTH} + ${dates.length} * ${NIGHT_WIDTH})`;
  const weekends = React.useMemo(
    () => new Set(dates.map((date, index) => ([0, 6].includes(parseISO(date).getDay()) ? index : -1))),
    [dates],
  );

  const select = (segment: FrontDeskSegment, room: FrontDeskRoom, group: FrontDeskGroup) => {
    setSelection({
      segment,
      roomNumber: room.number,
      roomName: group.roomName,
      photo: group.photo,
    });
    setOpen(true);
  };

  /** A drag across a room's own empty nights (`RoomRow`) — the desk's way to book a stay directly onto a specific room. */
  const startBooking = (group: FrontDeskGroup, room: FrontDeskRoom, startIndex: number, endIndex: number) => {
    setDraft({
      roomSlug: group.roomSlug,
      roomName: group.roomName,
      roomNumber: room.number,
      checkIn: dates[startIndex]!,
      checkOut: addIsoDays(dates[endIndex]!, 1),
    });
    setDraftOpen(true);
  };

  const bookingCreated = (message: string) => {
    setDraftOpen(false);
    toast.success(message);
    router.refresh();
  };

  // The open card holds its own copy of the segment; the board refreshes
  // underneath it, but the copy has to follow the desk's own move at once.
  const stayStateChanged = (state: StayState) => {
    setSelection((current) =>
      current && current.segment.kind === 'booking'
        ? { ...current, segment: { ...current.segment, stayState: state } }
        : current,
    );
  };

  return (
    <>
      <div className="relative overflow-x-auto rounded-[18px] bg-card shadow-soft contain-inline-size">
        <div style={{ minWidth }} className="text-sm">
          <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-20 flex items-end bg-card px-4 py-3 text-xs text-muted-foreground">
              {t('frontDesk.thRoom')}
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
                    {format(day, 'EEE', { locale: dateFns })}
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
                  <span className="sr-only"> {format(day, 'MMMM', { locale: dateFns })}</span>
                  {isToday ? <span className="sr-only">{t('frontDesk.todaySr')}</span> : null}
                </div>
              );
            })}
          </div>

          <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-20 bg-card px-4 py-2 text-xs text-muted-foreground">
              {t('frontDesk.occupied')}
            </div>
            {days.map((day, index) => {
              const occupiedOf = t('frontDesk.occupiedOf', { occupied: day.occupied, total: totalRooms });
              return (
                <div
                  key={day.date}
                  title={occupiedOf}
                  className={cn(
                    'border-l border-border py-2 text-center text-xs font-medium tabular-nums',
                    weekends.has(index) && 'bg-stone/50',
                  )}
                >
                  <span aria-hidden="true">{day.occupied}</span>
                  <span className="sr-only">{occupiedOf}</span>
                </div>
              );
            })}
          </div>

          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.roomTypeId);
            return (
            <div key={group.roomTypeId} role="group" aria-label={group.roomName}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroup(group.roomTypeId)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  toggleGroup(group.roomTypeId);
                }}
                className="cursor-pointer border-b border-border bg-stone/40 transition-colors hover:bg-stone/70"
              >
                <div className="sticky left-0 flex w-full max-w-[calc(100vw-4rem)] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <ChevronRightIcon
                      className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', !isCollapsed && 'rotate-90')}
                      aria-hidden="true"
                    />
                    <span className="font-medium">{group.roomName}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{lRoomCount(group.rooms.length, locale)}</span>
                  {group.hidden ? <span className={tag()}>{t('frontDesk.hiddenFromSite')}</span> : null}
                  <Link
                    href={`/admin/content/rooms/${group.roomTypeId}`}
                    aria-label={t('frontDesk.editRoomType', { roomType: group.roomName })}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(iconButton('dark', 'size-8'), 'ml-auto')}
                  >
                    <PencilSquareIcon className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
                <div className="sticky left-0 z-20 flex items-center bg-card px-4 py-1.5 text-xs text-muted-foreground">
                  {t('frontDesk.available')}
                </div>
                {availableByNight(group, dates.length).map((free, index) => {
                  const total = group.rooms.length;
                  return (
                    <div
                      key={dates[index]}
                      title={t('frontDesk.availableTitle', { free, total, roomType: group.roomName })}
                      className={cn(
                        'flex items-center justify-center border-l border-border py-1.5',
                        weekends.has(index) && 'bg-stone/50',
                      )}
                    >
                      <span
                        className={cn(
                          'min-w-7 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums',
                          free === 0
                            ? 'bg-danger/10 text-danger'
                            : free <= Math.max(1, Math.floor(total * 0.25))
                              ? 'bg-tint-sand text-tint-sand-ink'
                              : 'bg-tint-sage text-tint-sage-ink',
                        )}
                      >
                        <span aria-hidden="true">{free}</span>
                        <span className="sr-only">
                          {free === 0
                            ? t('frontDesk.availableSoldOut', { free, total })
                            : t('frontDesk.availableSr', { free, total })}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {isCollapsed ? null : group.rooms.map((room) => (
                <RoomRow
                  key={room.number}
                  room={room}
                  dates={dates}
                  columns={columns}
                  weekends={weekends}
                  today={today}
                  t={t}
                  locale={locale}
                  onSelectSegment={(segment) => select(segment, room, group)}
                  onDragCreate={(startIndex, endIndex) => startBooking(group, room, startIndex, endIndex)}
                />
              ))}
            </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={open}
        onClose={close}
        className="sm:max-w-2xl"
        title={
          selection?.segment.kind === 'booking'
            ? t('frontDesk.bookingTitle', { reference: selection.segment.reference })
            : selection?.segment.kind === 'closed'
              ? t('frontDesk.closedToSale')
              : t('frontDesk.simulatedDemand')
        }
      >
        {selection ? (
          <SelectionDetail
            selection={selection}
            dates={dates}
            today={today}
            t={t}
            locale={locale}
            onStayStateChanged={stayStateChanged}
          />
        ) : null}
      </Modal>

      <Modal open={draftOpen} onClose={closeDraft} className="sm:max-w-2xl" title={t('frontDesk.newBooking')}>
        {draft ? <CreateBookingForm draft={draft} t={t} locale={locale} onCreated={bookingCreated} onCancel={closeDraft} /> : null}
      </Modal>
    </>
  );
}

/** Rooms of a type with nothing on them each night — closed-to-sale rooms count as taken. */
function availableByNight(group: FrontDeskGroup, nights: number): number[] {
  const taken = Array.from({ length: nights }, () => 0);
  for (const room of group.rooms) {
    const busy = new Set<number>();
    for (const segment of room.segments) {
      for (let night = segment.start; night < segment.start + segment.span && night < nights; night += 1) {
        busy.add(night);
      }
    }
    for (const night of busy) taken[night] = (taken[night] ?? 0) + 1;
  }
  return taken.map((count) => group.rooms.length - count);
}

function SegmentBar({
  segment,
  label,
  closedText,
  today,
  onSelect,
}: {
  segment: FrontDeskSegment;
  label: string;
  closedText: string;
  today: string;
  onSelect: () => void;
}) {
  const style: React.CSSProperties = {
    gridColumn: `${segment.start + 2} / span ${segment.span}`,
    gridRow: 1,
  };

  const base =
    'relative z-10 mx-0.5 flex h-9 min-w-0 cursor-pointer items-center gap-1 self-center overflow-hidden rounded-full px-2.5 text-left text-xs font-medium transition-[filter] hover:brightness-95';

  if (segment.kind === 'closed') {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        title={label}
        style={{ ...style, ...unavailablePattern }}
        className={cn(base, 'bg-danger/10 text-danger')}
      >
        <Prohibit weight="fill" className="size-3.5 shrink-0" aria-hidden="true" />
        {segment.span >= 2 ? <span className="truncate">{closedText}</span> : null}
      </button>
    );
  }

  const status = stayStatus(segment.checkIn, segment.checkOut, today, segment.kind === 'booking' ? segment.stayState : undefined);
  const lastName = segment.guestName.split(' ').at(-1) ?? segment.guestName;
  const initials = segment.guestName
    .split(' ')
    .map((part) => part[0])
    .join('');
  const continuesBefore = segment.kind === 'booking' && segment.continuesBefore;
  const continuesAfter = segment.kind === 'booking' && segment.continuesAfter;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      title={label}
      style={style}
      className={cn(
        base,
        stayStatusMeta[status].className,
        continuesBefore && 'ml-0 rounded-l-none',
        continuesAfter && 'mr-0 rounded-r-none',
      )}
    >
      {segment.kind === 'booking' && segment.chosenByGuest ? (
        <PushPin weight="fill" className="size-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      <span className="truncate">{segment.span >= 2 ? lastName : initials}</span>
    </button>
  );
}

/**
 * One room's own strip of nights: the segments it already has, plus — on
 * whichever nights carry none — a drag surface. Mouse-only on purpose
 * (`pointerType !== 'mouse'` is ignored): the row already scrolls
 * horizontally under touch, and hijacking that gesture to start a booking
 * would cost more than the feature gives back. Pointer capture lands on the
 * row itself rather than the cell the drag started on, so the same drag
 * keeps reporting to one place as the cursor crosses into its neighbours;
 * `elementFromPoint` (capture-independent) turns that position back into a
 * night index without assuming every column is exactly `NIGHT_WIDTH` wide.
 */
function RoomRow({
  room,
  dates,
  columns,
  weekends,
  today,
  t,
  locale,
  onSelectSegment,
  onDragCreate,
}: {
  room: FrontDeskRoom;
  dates: string[];
  columns: string;
  weekends: Set<number>;
  today: string;
  t: AdminT;
  locale: AdminLocale;
  onSelectSegment: (segment: FrontDeskSegment) => void;
  onDragCreate: (startIndex: number, endIndex: number) => void;
}) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ pointerId: number; start: number } | null>(null);
  const [live, setLive] = React.useState<{ start: number; end: number } | null>(null);

  const occupiedNights = room.segments.reduce((sum, segment) => sum + segment.span, 0);

  /** A night with nothing on it — the only kind a drag may start or run through. */
  const free = React.useMemo(() => {
    const taken = Array.from({ length: dates.length }, () => false);
    for (const segment of room.segments) {
      for (let index = segment.start; index < segment.start + segment.span && index < dates.length; index += 1) {
        taken[index] = true;
      }
    }
    return taken.map((value) => !value);
  }, [room.segments, dates.length]);

  function nightIndexAt(x: number, y: number): number | null {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-night-index]');
    return cell ? Number(cell.dataset.nightIndex) : null;
  }

  /** Extends the live range from the drag's start toward `index`, stopping at the first occupied night either way. */
  function extendTo(index: number) {
    const drag = dragRef.current;
    if (!drag) return;
    let end = drag.start;
    if (index >= drag.start) {
      for (let i = drag.start + 1; i <= index && free[i]; i += 1) end = i;
    } else {
      for (let i = drag.start - 1; i >= index && free[i]; i -= 1) end = i;
    }
    setLive({ start: Math.min(drag.start, end), end: Math.max(drag.start, end) });
  }

  function onNightPointerDown(event: React.PointerEvent, index: number) {
    if (event.button !== 0 || event.pointerType !== 'mouse') return;
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, start: index };
    setLive({ start: index, end: index });
    rowRef.current?.setPointerCapture(event.pointerId);
  }

  function onRowPointerMove(event: React.PointerEvent) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const index = nightIndexAt(event.clientX, event.clientY);
    if (index !== null) extendTo(index);
  }

  function endDrag(event: React.PointerEvent) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    rowRef.current?.releasePointerCapture(event.pointerId);
    const range = live;
    setLive(null);
    if (range) onDragCreate(range.start, range.end);
  }

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={lRoomNumber(room.number, locale)}
      className="grid min-h-14 border-b border-border"
      style={{ gridTemplateColumns: columns }}
      onPointerMove={onRowPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="sticky left-0 z-20 row-start-1 flex flex-col justify-center bg-card px-4 py-2" style={{ gridColumn: 1 }}>
        <span className="font-medium tabular-nums">{room.number}</span>
        <span className="truncate text-xs text-muted-foreground">
          {lFloor(room.floor, locale)} · {lFacade(room.facade, locale)}
        </span>
        <span className="sr-only">
          {t('frontDesk.freeNightsSr', { free: dates.length - occupiedNights, total: dates.length })}
        </span>
      </div>
      {dates.map((date, index) => (
        <div
          key={date}
          data-night-index={index}
          aria-hidden="true"
          title={free[index] ? t('frontDesk.dragToBook', { room: lRoomNumber(room.number, locale), date: lDateShort(date, locale) }) : undefined}
          onPointerDown={free[index] ? (event) => onNightPointerDown(event, index) : undefined}
          className={cn(
            'row-start-1 border-l border-border',
            weekends.has(index) && 'bg-stone/50',
            free[index] && 'cursor-pointer hover:bg-accent-soft/50',
          )}
          style={{ gridColumn: index + 2 }}
        />
      ))}
      {room.segments.map((segment) => (
        <SegmentBar
          key={`${segment.kind}-${segment.start}`}
          segment={segment}
          label={segmentLabel(segment, dates, room.number, today, t, locale)}
          closedText={t('frontDesk.closed')}
          today={today}
          onSelect={() => onSelectSegment(segment)}
        />
      ))}
      {live ? (
        <div
          aria-hidden="true"
          style={{ gridColumn: `${live.start + 2} / span ${live.end - live.start + 1}`, gridRow: 1 }}
          className="relative z-10 mx-0.5 flex h-9 items-center justify-center self-center rounded-full border-2 border-dashed border-accent bg-accent-soft/70 text-accent-strong"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}

function SelectionDetail({
  selection,
  dates,
  today,
  t,
  locale,
  onStayStateChanged,
}: {
  selection: Selection;
  dates: string[];
  today: string;
  t: AdminT;
  locale: AdminLocale;
  onStayStateChanged: (state: StayState) => void;
}) {
  const { segment, roomNumber, roomName, photo } = selection;

  if (segment.kind === 'closed') {
    const { from, to } = segmentRange(segment, dates);
    return (
      <div>
        <p className="text-display text-2xl tabular-nums">{lRoomNumber(roomNumber, locale)}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{roomName}</p>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <Field label={t('frontDesk.dates')} wide>
            {lDateRange(from, to, locale)}
          </Field>
          <Field label={t('frontDesk.nights')}>{segment.span}</Field>
        </dl>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{t('frontDesk.closedBody')}</p>
        <div className="mt-6">
          <Link href="/admin/rates" className={pill('secondary')}>
            {t('frontDesk.ratesAvailability')}
          </Link>
        </div>
      </div>
    );
  }

  // A stay, real or simulated: the desk opens this to answer "who, when, how
  // many, what it comes to, is it paid" — the same questions a PMS tape chart
  // answers on click. The dates lead; the room type's photograph is a
  // thumbnail beside the room number, not a hero over the facts, and its
  // catalog description is not here at all — that is the guest's copy.
  const nights = nightsBetween(segment.checkIn, segment.checkOut);
  const money = (amount: number) => lMoney(amount, segment.currency, locale);
  const canCancel = segment.kind === 'booking' && segment.status === 'confirmed' && segment.checkIn > today;
  const cancelBlockedReason =
    segment.kind !== 'booking' || canCancel
      ? undefined
      : segment.status === 'cancelled'
        ? t('bookings.alreadyCancelled')
        : t('bookings.stayBegun');
  const balance = segment.total - segment.paid;
  const payment =
    segment.paid <= 0
      ? { label: t('ops.awaitingPayment'), tone: 'text-warning', Icon: Clock }
      : balance > 0.005
        ? { label: t('frontDesk.paidPartly', { paid: money(segment.paid), balance: money(balance) }), tone: 'text-warning', Icon: Clock }
        : { label: t('frontDesk.paidInFull'), tone: 'text-success', Icon: CheckCircle };

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <span className="block size-16 shrink-0 overflow-hidden rounded-[18px] bg-stone">
          {photo ? (
            <img src={photo.url} alt="" width={photo.width} height={photo.height} className="size-full object-cover" />
          ) : null}
        </span>
        <div className="min-w-0">
          <p className="text-display text-2xl tabular-nums">{lRoomNumber(roomNumber, locale)}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">{roomName}</p>
        </div>
      </div>
      {segment.kind === 'booking' ? (
        <StayStateMenu
          reference={segment.reference}
          status={segment.status}
          stayState={segment.stayState}
          canCancel={canCancel}
          cancelBlockedReason={cancelBlockedReason}
          onChanged={onStayStateChanged}
        />
      ) : null}
    </div>
  );

  const stay = (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
      <Field label={t('ops.thCheckIn')} sub={segment.checkInTime}>
        {lDateShort(segment.checkIn, locale)}
      </Field>
      <Field label={t('ops.thCheckOut')} sub={segment.checkOutTime}>
        {lDateShort(segment.checkOut, locale)}
      </Field>
      <Field label={t('booking.duration')}>{lNights(nights, locale)}</Field>
      <Field label={t('ops.thGuests')}>{lGuests(segment.adults, segment.children, locale)}</Field>
      <Field label={t('frontDesk.roomRate')} sub={segment.breakfastIncluded ? t('frontDesk.breakfastIncluded') : undefined}>
        {segment.ratePlanName}
      </Field>
      <Field
        label={t('frontDesk.total')}
        sub={
          <span className={cn('inline-flex items-center gap-1', payment.tone)}>
            <payment.Icon weight="fill" className="size-3.5 shrink-0" aria-hidden="true" />
            {payment.label}
          </span>
        }
      >
        {money(segment.total)}
      </Field>
      {segment.kind === 'booking' ? (
        <Field label={t('ops.thRoom')}>
          {segment.chosenByGuest ? (
            <span className="inline-flex items-center gap-1">
              <PushPin weight="fill" className="size-3.5" aria-hidden="true" />
              {t('booking.chosenByGuest')}
            </span>
          ) : (
            t('booking.assignedAuto')
          )}
        </Field>
      ) : (
        <Field label={t('frontDesk.source')}>{segment.channel}</Field>
      )}
    </dl>
  );

  if (segment.kind === 'demand') {
    return (
      <div>
        {heading}
        <div className="mt-4 border-t border-border pt-4">
          <p className="font-medium">{segment.guestName}</p>
        </div>
        {stay}
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{t('frontDesk.demandBody')}</p>
      </div>
    );
  }

  // A real reservation is also editable from here, since a click on this
  // grid is one of two doors into the same booking (see `actions.ts`'s doc
  // comment), not a read-only preview of it. Cancelling sits in the status
  // menu above, with the desk's own check-in / check-out.
  return (
    <div>
      {heading}

      <div className="mt-4 border-t border-border pt-4">
        <p className="font-medium">{segment.guestName}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <a href={`tel:${segment.guestPhone.replace(/\s+/g, '')}`} className="hover:text-accent-strong">
            {segment.guestPhone}
          </a>
          <a href={`mailto:${segment.guestEmail}`} className="hover:text-accent-strong">
            {segment.guestEmail}
          </a>
        </div>
      </div>

      {stay}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={`/admin/bookings/${segment.reference}`} className={pill('secondary')}>
          {t('ops.edit')}
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  sub,
  wide,
  children,
}: {
  label: string;
  /** A second, quieter line under the value — a time, a note, a state. */
  sub?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{children}</dd>
      {sub ? <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

/**
 * The desk's own booking form: a dragged range plus who it is for. Price is
 * informational only — quoted fresh whenever the party size changes, purely
 * so the desk sees a number before committing — the create action re-quotes
 * and confirms in the same request, so nothing typed here is ever trusted
 * back as a total (see `app/admin/front-desk/actions.ts`).
 */
function CreateBookingForm({
  draft,
  t,
  locale,
  onCreated,
  onCancel,
}: {
  draft: BookingDraft;
  t: AdminT;
  locale: AdminLocale;
  onCreated: (message: string) => void;
  onCancel: () => void;
}) {
  const nights = nightsBetween(draft.checkIn, draft.checkOut);
  const [party, setParty] = React.useState<GuestParty>(emptyGuestParty);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('pay_at_hotel');
  const [quote, setQuote] = React.useState<FrontDeskQuoteResult | null>(null);
  const [quoting, setQuoting] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let live = true;
    setQuoting(true);
    quoteFrontDeskBookingAction({
      roomSlug: draft.roomSlug,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      adults: party.adults,
      children: party.children,
    }).then((result) => {
      if (live) {
        setQuote(result);
        setQuoting(false);
      }
    });
    return () => {
      live = false;
    };
  }, [draft.roomSlug, draft.checkIn, draft.checkOut, party.adults, party.children]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    const { firstName, lastName, email, phone, adults, children } = party;
    const result = await createFrontDeskBookingAction({
      roomSlug: draft.roomSlug,
      unitNumber: draft.roomNumber,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      adults,
      children,
      guest: { firstName, lastName, email, phone },
      paymentMethod,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated(result.message);
      return;
    }
    setError(result.message);
    setFieldErrors(result.fieldErrors ?? {});
  }

  return (
    <form onSubmit={submit}>
      <p className="text-display text-2xl tabular-nums">{lRoomNumber(draft.roomNumber, locale)}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {t('frontDesk.newBookingBody', {
          room: draft.roomName,
          dates: `${lDateRange(draft.checkIn, draft.checkOut, locale)} · ${lNights(nights, locale)}`,
        })}
      </p>

      <div className="mt-5">
        <GuestPartyFields value={party} onChange={(patch) => setParty((current) => ({ ...current, ...patch }))} t={t} fieldErrors={fieldErrors} />
      </div>

      <div className="mt-4">
        <PaymentMethodField value={paymentMethod} onChange={setPaymentMethod} t={t} locale={locale} />
      </div>

      <PriceFooter t={t} locale={locale} quoting={quoting} quote={quote} paymentMethod={paymentMethod} />

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={submitting || quoting || quote?.ok !== true} className={pill('primary')}>
          {submitting ? t('frontDesk.creatingBooking') : t('frontDesk.createBooking')}
        </button>
        <button type="button" onClick={onCancel} className={pill('secondary')}>
          {t('frontDesk.cancel')}
        </button>
      </div>
    </form>
  );
}
