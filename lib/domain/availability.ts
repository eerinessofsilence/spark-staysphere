import { addDays, format, parseISO } from 'date-fns';
import type { RoomStatus } from './schemas';

/**
 * Pure, deterministic simulated-demand rules shared by every repository
 * backend (in-memory and D1). Keeping this in one place means a booking made
 * against one backend and a quote read from another can never disagree about
 * the baseline occupancy — only the durable override/hold state differs.
 */

/** Physical units per room type. Rarer rooms sell out more often in the demo. */
const baseUnits: Record<string, number> = {
  'room_deluxe-sea': 8,
  'room_garden-studio': 7,
  'room_panorama-suite': 4,
  'room_pool-terrace': 6,
  'room_family-residence': 4,
  'room_skyline-loft': 5,
  'room_coastal-twin': 8,
  'room_asteria-penthouse': 2,
};

export function unitsFor(roomTypeId: string): number {
  return baseUnits[roomTypeId] ?? 5;
}

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
 * Simulated baseline demand for one room on one night, before any admin
 * override or real confirmed-booking hold is applied. Cubed load skews
 * occupancy low, so most nights are sellable and scarcity stays rare enough
 * to be a demonstration rather than a dead end.
 */
export function baseRemaining(roomTypeId: string, date: string): number {
  const units = unitsFor(roomTypeId);
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
  date: string,
  override: RoomStatus | null,
  held: number,
): number {
  const units = unitsFor(roomTypeId);
  if (override === 'sold_out') return 0;
  if (override === 'last_room') return 1;
  if (override === 'limited') return Math.min(units, 2);
  if (override === 'available') return units;
  return Math.max(0, baseRemaining(roomTypeId, date) - held);
}
