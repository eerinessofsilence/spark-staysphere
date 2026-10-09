import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaLibraryPort } from '../domain/ports';
import { demoHotel } from '../infrastructure/mock-data';
import { mockCatalogContentPort } from '../infrastructure/catalog-content-mock';
import { mockHotelRepository } from '../infrastructure/mock-hotel-repository';
import { createBookingEngineAdapter } from '../infrastructure/mock-adapters';
import { mockSpinnerMarkupPort } from '../infrastructure/spinner-markup-mock';
import { mockSpinnerFrameStoragePort } from '../infrastructure/spinner-frame-storage-mock';
import { CatalogService } from './catalog-service';
import { ContentService } from './content-service';

const noopMedia: MediaLibraryPort = { list: () => [], find: () => undefined };
const SQUARE = { points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]] as [number, number][] };

function makeContentService() {
  return new ContentService(
    mockHotelRepository,
    mockCatalogContentPort,
    noopMedia,
    mockSpinnerMarkupPort,
    mockSpinnerFrameStoragePort,
    demoHotel.slug,
    { hotel: new Set([demoHotel.id]), room: new Set(), unit: new Set(), rate: new Set(), addon: new Set() },
  );
}

function makeCatalogService() {
  return new CatalogService(mockHotelRepository, createBookingEngineAdapter(mockHotelRepository), mockSpinnerMarkupPort);
}

describe('CatalogService.getSpinnerZones', () => {
  let content: ContentService;
  let catalog: CatalogService;

  beforeEach(async () => {
    content = makeContentService();
    catalog = makeCatalogService();
    await content.resetContent();
  });

  it('resolves a zone bound to a real room into a guest-facing link', async () => {
    const markup = await content.getSpinnerMarkupContent();
    const keyAngle = markup!.keyAngles[0]!;
    const unit = markup!.units[0]!;

    await content.saveSpinnerZones(keyAngle, {
      upserts: [{ id: '3f2b8c1e-6a4d-4f0e-9b7a-2c5d8e1f0a3b', polygon: SQUARE, target: { kind: 'unit', unitId: unit.id } }],
      deletes: [],
    });

    const zones = await catalog.getSpinnerZones(demoHotel.slug);
    expect(zones).toHaveLength(1);
    const zone = zones[0]!;
    expect(zone.kind).toBe('unit');
    if (zone.kind !== 'unit') throw new Error('unreachable');
    expect(zone).toMatchObject({ unitNumber: unit.number, floor: unit.floor, href: `/rooms/${zone.roomSlug}` });
  });

  it('drops a zone whose target no longer exists (e.g. its room type was deleted after the zone was bound)', async () => {
    const markup = await content.getSpinnerMarkupContent();
    const keyAngle = markup!.keyAngles[0]!;

    // Bypasses ContentService's own validation — this simulates a room type
    // that existed when the zone was bound and was deleted afterwards, not a
    // bad write ContentService should have caught.
    await mockSpinnerMarkupPort.applyZoneBatch(demoHotel.id, {
      upserts: [
        { id: '9a1c2e3f-4b5d-4c6e-8f7a-0b1c2d3e4f5a', frameIndex: keyAngle, polygon: SQUARE, target: { kind: 'roomType', roomTypeId: 'no-such-room' } },
      ],
      deletes: [],
    });

    const zones = await catalog.getSpinnerZones(demoHotel.slug);
    expect(zones).toHaveLength(0);
  });

  it('drops an unbound zone (target: null)', async () => {
    const markup = await content.getSpinnerMarkupContent();
    const keyAngle = markup!.keyAngles[0]!;

    await content.saveSpinnerZones(keyAngle, {
      upserts: [{ id: '3f2b8c1e-6a4d-4f0e-9b7a-2c5d8e1f0a3b', polygon: SQUARE, target: null }],
      deletes: [],
    });

    const zones = await catalog.getSpinnerZones(demoHotel.slug);
    expect(zones).toHaveLength(0);
  });

  it('resolves a link target verbatim', async () => {
    const markup = await content.getSpinnerMarkupContent();
    const keyAngle = markup!.keyAngles[0]!;

    await content.saveSpinnerZones(keyAngle, {
      upserts: [
        {
          id: '3f2b8c1e-6a4d-4f0e-9b7a-2c5d8e1f0a3b',
          polygon: SQUARE,
          target: { kind: 'link', label: 'Pool bar', description: 'Lunch by the water.', href: '/rooms?addOn=addon_late', cta: 'See more' },
        },
      ],
      deletes: [],
    });

    const zones = await catalog.getSpinnerZones(demoHotel.slug);
    expect(zones).toEqual([
      {
        id: '3f2b8c1e-6a4d-4f0e-9b7a-2c5d8e1f0a3b',
        frameIndex: keyAngle,
        polygon: SQUARE,
        kind: 'link',
        label: 'Pool bar',
        description: 'Lunch by the water.',
        cta: 'See more',
        href: '/rooms?addOn=addon_late',
      },
    ]);
  });
});
