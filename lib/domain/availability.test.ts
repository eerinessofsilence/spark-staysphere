import { describe, expect, it } from 'vitest';
import {
  nightsInRange,
  resolveRemaining,
  statusForRemaining,
  stayBucket,
  unitsFor,
} from './availability';

describe('unitsFor', () => {
  it('returns the seeded unit count for a known room type', () => {
    expect(unitsFor('room_asteria-penthouse')).toBe(2);
  });

  it('defaults an unknown room type (e.g. one created in the CMS) to 5 units', () => {
    expect(unitsFor('room_cms-created-suite')).toBe(5);
  });
});

describe('statusForRemaining', () => {
  it.each([
    [0, 'sold_out'],
    [-1, 'sold_out'],
    [1, 'last_room'],
    [2, 'limited'],
    [3, 'limited'],
    [4, 'available'],
    [20, 'available'],
  ] as const)('remaining=%i -> %s', (remaining, status) => {
    expect(statusForRemaining(remaining)).toBe(status);
  });
});

describe('nightsInRange', () => {
  it('lists every date in [from, to), excluding checkout day', () => {
    expect(nightsInRange('2026-10-01', '2026-10-04')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('returns an empty list for an unparsable start date', () => {
    expect(nightsInRange('not-a-date', '2026-10-04')).toEqual([]);
  });

  it('falls back to a single night (the check-in date) for a same-day or reversed range', () => {
    expect(nightsInRange('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
    expect(nightsInRange('2026-10-05', '2026-10-01')).toEqual(['2026-10-05']);
  });

  it('caps a very long stay instead of looping unbounded', () => {
    const nights = nightsInRange('2026-01-01', '2027-01-01');
    expect(nights.length).toBe(61);
    expect(nights).not.toContain('2026-12-31');
  });
});

describe('resolveRemaining', () => {
  const roomTypeId = 'room_deluxe-sea'; // 8 units seeded
  const date = '2026-10-01';

  it('is always zero once the override is sold_out, regardless of holds', () => {
    expect(resolveRemaining(roomTypeId, date, 'sold_out', 0)).toBe(0);
  });

  it('caps last_room at one minus what is already held', () => {
    expect(resolveRemaining(roomTypeId, date, 'last_room', 0)).toBe(1);
    expect(resolveRemaining(roomTypeId, date, 'last_room', 1)).toBe(0);
  });

  it('never goes negative when holds exceed the override ceiling', () => {
    expect(resolveRemaining(roomTypeId, date, 'last_room', 5)).toBe(0);
    expect(resolveRemaining(roomTypeId, date, 'limited', 5)).toBe(0);
  });

  it('caps limited at two minus what is already held', () => {
    expect(resolveRemaining(roomTypeId, date, 'limited', 0)).toBe(2);
    expect(resolveRemaining(roomTypeId, date, 'limited', 1)).toBe(1);
  });

  it('caps available at the room type\'s full unit count minus holds', () => {
    expect(resolveRemaining(roomTypeId, date, 'available', 0)).toBe(8);
    expect(resolveRemaining(roomTypeId, date, 'available', 3)).toBe(5);
  });

  it('falls back to simulated demand minus holds with no override', () => {
    const noHolds = resolveRemaining(roomTypeId, date, null, 0);
    const withHolds = resolveRemaining(roomTypeId, date, null, 2);
    expect(withHolds).toBe(Math.max(0, noHolds - 2));
  });

  it('gives an unknown (CMS-created) room type the same default-unit demand curve', () => {
    // Must not throw or silently treat the room as having zero units.
    const remaining = resolveRemaining('room_cms-created-suite', date, null, 0);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThanOrEqual(5);
  });
});

describe('stayBucket', () => {
  const today = '2026-10-10';

  it('is cancelled whenever the status says so, regardless of dates', () => {
    expect(
      stayBucket({ checkIn: '2026-10-01', checkOut: '2026-10-20', status: 'cancelled' }, today),
    ).toBe('cancelled');
  });

  it('is past once checkout has happened, including on the checkout date itself', () => {
    expect(
      stayBucket({ checkIn: '2026-10-05', checkOut: '2026-10-10', status: 'confirmed' }, today),
    ).toBe('past');
    expect(
      stayBucket({ checkIn: '2026-10-05', checkOut: '2026-10-09', status: 'confirmed' }, today),
    ).toBe('past');
  });

  it('is in_house once check-in has happened but checkout has not', () => {
    expect(
      stayBucket({ checkIn: '2026-10-10', checkOut: '2026-10-15', status: 'confirmed' }, today),
    ).toBe('in_house');
    expect(
      stayBucket({ checkIn: '2026-10-01', checkOut: '2026-10-15', status: 'confirmed' }, today),
    ).toBe('in_house');
  });

  it('is upcoming when check-in has not happened yet', () => {
    expect(
      stayBucket({ checkIn: '2026-10-11', checkOut: '2026-10-15', status: 'confirmed' }, today),
    ).toBe('upcoming');
  });
});
