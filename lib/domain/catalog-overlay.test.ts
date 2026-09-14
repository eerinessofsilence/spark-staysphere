import { describe, expect, it } from 'vitest';
import type { CatalogEntryRecord } from './ports';
import { effectiveVersion, mergeCatalog } from './catalog-overlay';

interface Item {
  id: string;
  name: string;
}

function entry(id: string, data: Item, version = 1): CatalogEntryRecord<Item> {
  return {
    kind: 'room',
    id,
    hotelId: 'hotel_asteria-cove',
    data,
    version,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('mergeCatalog', () => {
  const seed: Item[] = [
    { id: 'room_a', name: 'Seed A' },
    { id: 'room_b', name: 'Seed B' },
  ];

  it('returns the seed unchanged when there is no overlay', () => {
    expect(mergeCatalog(seed, [])).toEqual(seed);
  });

  it('replaces a seed entity wholesale when an overlay row shares its id', () => {
    const overlay = [entry('room_a', { id: 'room_a', name: 'Renamed A' })];
    const merged = mergeCatalog(seed, overlay);
    expect(merged).toEqual([{ id: 'room_a', name: 'Renamed A' }, seed[1]]);
  });

  it('appends an overlay row whose id the seed never had, sorted by id', () => {
    const overlay = [
      entry('room_z', { id: 'room_z', name: 'New Z' }),
      entry('room_x', { id: 'room_x', name: 'New X' }),
    ];
    const merged = mergeCatalog(seed, overlay);
    expect(merged.map((item) => item.id)).toEqual(['room_a', 'room_b', 'room_x', 'room_z']);
  });

  it('never reorders or drops the seed items themselves', () => {
    const overlay = [entry('room_new', { id: 'room_new', name: 'New' })];
    const merged = mergeCatalog(seed, overlay);
    expect(merged.slice(0, 2)).toEqual(seed);
  });
});

describe('effectiveVersion', () => {
  it('is 0 for a seed entity that has never been overlaid', () => {
    expect(effectiveVersion([], 'room_a')).toBe(0);
  });

  it('is the overlay row\'s version once one exists', () => {
    const overlay = [entry('room_a', { id: 'room_a', name: 'Renamed' }, 3)];
    expect(effectiveVersion(overlay, 'room_a')).toBe(3);
  });
});
