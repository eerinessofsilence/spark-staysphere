import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaLibraryPort } from '../domain/ports';
import { demoHotel } from '../infrastructure/mock-data';
import { mockCatalogContentPort } from '../infrastructure/catalog-content-mock';
import { mockHotelRepository } from '../infrastructure/mock-hotel-repository';
import { mockSpinnerMarkupPort } from '../infrastructure/spinner-markup-mock';
import { mockSpinnerFrameStoragePort } from '../infrastructure/spinner-frame-storage-mock';
import { ContentService } from './content-service';

const noopMedia: MediaLibraryPort = { list: () => [], find: () => undefined };

const SQUARE = { points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]] as [number, number][] };
const ID = '3f2b8c1e-6a4d-4f0e-9b7a-2c5d8e1f0a3b';

function makeService() {
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

describe('ContentService spinner markup', () => {
  let service: ContentService;
  let keyAngle: number;
  let otherFrame: number;

  beforeEach(async () => {
    service = makeService();
    await service.resetContent();
    const content = await service.getSpinnerMarkupContent();
    keyAngle = content!.keyAngles[0]!;
    otherFrame = content!.frames.find((frame) => !content!.keyAngles.includes(frame.index))!.index;
  });

  it('reports the current frames, key angles and an empty zone list', async () => {
    const content = await service.getSpinnerMarkupContent();
    expect(content).not.toBeNull();
    expect(content!.keyAngles.length).toBeGreaterThan(0);
    expect(content!.zones).toEqual([]);
    expect(content!.units.length).toBeGreaterThan(0);
    expect(content!.roomTypes.length).toBeGreaterThan(0);
  });

  it('saves a zone bound to a real room, and getSpinnerMarkupContent reflects it', async () => {
    const content = await service.getSpinnerMarkupContent();
    const unit = content!.units[0]!;

    const result = await service.saveSpinnerZones(keyAngle, {
      upserts: [{ id: ID, polygon: SQUARE, target: { kind: 'unit', unitId: unit.id } }],
      deletes: [],
    });
    expect(result).toEqual({ ok: true, saved: 1, removed: 0 });

    const after = await service.getSpinnerMarkupContent();
    expect(after!.zones).toHaveLength(1);
    expect(after!.zones[0]).toMatchObject({ id: ID, frameIndex: keyAngle, target: { kind: 'unit', unitId: unit.id } });
  });

  it('rejects a frame that is not one of the spinner\'s key angles', async () => {
    const result = await service.saveSpinnerZones(otherFrame, {
      upserts: [{ id: ID, polygon: SQUARE, target: null }],
      deletes: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/key-angle/);
  });

  it('rejects a target pointing at a room that does not exist', async () => {
    const result = await service.saveSpinnerZones(keyAngle, {
      upserts: [{ id: ID, polygon: SQUARE, target: { kind: 'unit', unitId: 'no-such-unit' } }],
      deletes: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no longer exists/);
  });

  it('rejects a malformed polygon and writes nothing', async () => {
    const result = await service.saveSpinnerZones(keyAngle, {
      upserts: [{ id: ID, polygon: { points: [[0, 0], [1, 1]] }, target: null }],
      deletes: [],
    });
    expect(result.ok).toBe(false);

    const after = await service.getSpinnerMarkupContent();
    expect(after!.zones).toHaveLength(0);
  });

  it('deletes a zone by id, scoped to this hotel', async () => {
    await service.saveSpinnerZones(keyAngle, { upserts: [{ id: ID, polygon: SQUARE, target: null }], deletes: [] });
    const result = await service.saveSpinnerZones(keyAngle, { upserts: [], deletes: [ID] });
    expect(result).toEqual({ ok: true, saved: 0, removed: 1 });

    const after = await service.getSpinnerMarkupContent();
    expect(after!.zones).toHaveLength(0);
  });

  it('resetContent clears zones along with the rest of the CMS overlay', async () => {
    await service.saveSpinnerZones(keyAngle, { upserts: [{ id: ID, polygon: SQUARE, target: null }], deletes: [] });
    await service.resetContent();

    const after = await service.getSpinnerMarkupContent();
    expect(after!.zones).toHaveLength(0);
  });
});
