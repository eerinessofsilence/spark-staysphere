import type { RoomOccupancy } from '@/lib/domain/housekeeping';
import type { HousekeepingStatus } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from './dictionaries';

/** The status's name in the team member's language: `t(housekeepingStatusKey(status))`. */
export function housekeepingStatusKey(status: HousekeepingStatus): AdminTranslationKey {
  return `housekeeping.status.${status}`;
}

export function occupancyKey(occupancy: RoomOccupancy): AdminTranslationKey {
  return `housekeeping.occupancy.${occupancy}`;
}
