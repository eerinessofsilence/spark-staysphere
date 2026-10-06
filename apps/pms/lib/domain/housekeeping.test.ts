import { describe, expect, it } from 'vitest';
import { defaultHousekeepingStatus, HOUSEKEEPING_STATUSES } from './housekeeping';

describe('defaultHousekeepingStatus', () => {
  it('reads a departure as dirty and a stayover as clean, whatever the room', () => {
    for (const unitId of ['unit-1', 'unit-2', 'unit-3', 'unit-4', 'unit-5']) {
      expect(defaultHousekeepingStatus(unitId, 'departing')).toBe('dirty');
      expect(defaultHousekeepingStatus(unitId, 'occupied')).toBe('clean');
    }
  });

  it('scatters a few vacant rooms across the board deterministically', () => {
    const ids = Array.from({ length: 60 }, (_, index) => `unit-${index}`);
    const statuses = ids.map((id) => defaultHousekeepingStatus(id, 'vacant'));
    expect(statuses.every((status) => HOUSEKEEPING_STATUSES.includes(status))).toBe(true);
    expect(new Set(statuses).size).toBeGreaterThan(1);
    expect(statuses.filter((status) => status === 'clean').length).toBeGreaterThan(statuses.length / 2);
    expect(ids.map((id) => defaultHousekeepingStatus(id, 'vacant'))).toEqual(statuses);
  });

  it('never defaults a room to out of order', () => {
    const ids = Array.from({ length: 200 }, (_, index) => `unit-${index}`);
    for (const occupancy of ['vacant', 'arriving', 'occupied', 'departing'] as const) {
      expect(ids.some((id) => defaultHousekeepingStatus(id, occupancy) === 'out_of_order')).toBe(false);
    }
  });
});
