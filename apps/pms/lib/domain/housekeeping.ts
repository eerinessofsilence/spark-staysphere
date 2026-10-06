import { demoHash } from './availability';
import type { HousekeepingStatus } from './schemas';

/**
 * Housekeeping's own view of the building: one status per physical room,
 * apart from whether anyone is staying in it. The desk reads both together
 * — a departed room is dirty until someone says otherwise, an arriving
 * guest needs a clean or inspected one.
 */

/** In the order a housekeeping board lists them: what needs doing first, then what is done. */
export const HOUSEKEEPING_STATUSES: readonly HousekeepingStatus[] = [
  'dirty',
  'in_progress',
  'clean',
  'inspected',
  'out_of_order',
];

/** What the front desk knows about a room today, as far as housekeeping cares. */
export type RoomOccupancy = 'occupied' | 'arriving' | 'departing' | 'vacant';

/**
 * A room nobody has marked yet. A departure is dirty by definition; a
 * stayover was cleaned for its guest; the rest of the building is mostly
 * clean, with a few rooms still on the trolley so the board reads like a
 * morning rather than a spreadsheet — hashed on the room id so the same
 * doors are dirty on every load.
 */
export function defaultHousekeepingStatus(unitId: string, occupancy: RoomOccupancy): HousekeepingStatus {
  if (occupancy === 'departing') return 'dirty';
  if (occupancy === 'occupied') return 'clean';
  const roll = demoHash(`housekeeping#${unitId}`) % 10;
  if (roll < 2) return 'dirty';
  if (roll === 2) return 'in_progress';
  if (roll === 3) return 'inspected';
  return 'clean';
}
