import { addDays, format, parseISO } from 'date-fns';
import type { RoomStatus } from './schemas';

/**
 * Pure, deterministic simulated-demand rules shared by every repository
 * backend (in-memory and D1). Keeping this in one place means a booking made
 * against one backend and a quote read from another can never disagree about
 * the baseline occupancy — only the durable override/hold state differs.
 *
 * `units` is always the number of stored physical rooms of the type (see
 * `HotelRepository.listPhysicalRooms`), so the rooms the CMS lists and the
 * rooms availability sells are the same count.
 */

/** Stable 32-bit hash so availability is identical on server render and reload. */
export function demoHash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

export function statusForRemaining(remaining: number): RoomStatus {
  if (remaining <= 0) return 'sold_out';
  if (remaining === 1) return 'last_room';
  if (remaining <= 3) return 'limited';
  return 'available';
}

export type StayBucket = 'upcoming' | 'in_house' | 'past' | 'cancelled';

/**
 * Where a stay sits relative to today, for both the guest trips list and the
 * back office's booking list — one rule so the two screens never disagree
 * about whether a stay is still "upcoming". Consistent with `nightsInRange`
 * treating `to` as exclusive: the checkout date itself is not a stay night,
 * so a stay is already `past` once `checkOut <= today`.
 */
export function stayBucket(
  stay: { checkIn: string; checkOut: string; status: string },
  today: string,
): StayBucket {
  if (stay.status === 'cancelled') return 'cancelled';
  if (stay.checkOut <= today) return 'past';
  if (stay.checkIn <= today) return 'in_house';
  return 'upcoming';
}

/** Every calendar date in `[from, to)`, capped so a bad range can't loop forever. */
export function nightsInRange(from: string, to: string): string[] {
  const start = parseISO(from);
  const end = parseISO(to);
  if (Number.isNaN(start.getTime())) return [];
  if (Number.isNaN(end.getTime()) || end <= start) return [format(start, 'yyyy-MM-dd')];

  const dates: string[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) {
    dates.push(format(cursor, 'yyyy-MM-dd'));
    if (dates.length > 60) break;
  }
  return dates;
}

/**
 * Simulated baseline demand for a room type with `units` rooms on one night,
 * before any admin override or real confirmed-booking hold is applied. Cubed
 * load skews occupancy low, so most nights are sellable and scarcity stays
 * rare enough to be a demonstration rather than a dead end.
 */
export function baseRemaining(roomTypeId: string, units: number, date: string): number {
  const load = (demoHash(`${roomTypeId}|${date}`) % 100) / 100;
  const taken = Math.round(units * load ** 3);
  return Math.max(0, units - taken);
}

/**
 * The one formula that turns (override, simulated demand, real holds) into a
 * remaining count. Every repository backend — in-memory or D1 — calls this
 * instead of reimplementing it, so a booking made against one backend and an
 * availability read from another can never disagree about what "remaining"
 * means, only about where the override/hold numbers came from.
 */
export function resolveRemaining(
  roomTypeId: string,
  units: number,
  date: string,
  override: RoomStatus | null,
  held: number,
): number {
  if (units <= 0) return 0;
  if (override === 'sold_out') return 0;
  // An override sets a ceiling, not a fixed count: it must still come down as
  // real confirmed bookings take rooms, or a room already sold out under the
  // override would go on reporting availability forever.
  if (override === 'last_room') return Math.max(0, 1 - held);
  if (override === 'limited') return Math.max(0, Math.min(units, 2) - held);
  if (override === 'available') return Math.max(0, units - held);
  return Math.max(0, baseRemaining(roomTypeId, units, date) - held);
}
