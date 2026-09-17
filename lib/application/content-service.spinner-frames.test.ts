import { beforeEach, describe, expect, it } from 'vitest';
import { mergeCatalog } from '../domain/catalog-overlay';
import type { CatalogEntryRecord, MediaLibraryPort } from '../domain/ports';
import type { Hotel } from '../domain/schemas';
import { demoHotel } from '../infrastructure/mock-data';
import { mockCatalogContentPort } from '../infrastructure/catalog-content-mock';
import { mockHotelRepository } from '../infrastructure/mock-hotel-repository';
import { mockSpinnerMarkupPort } from '../infrastructure/spinner-markup-mock';
import { mockSpinnerFrameStoragePort, readMockFrame } from '../infrastructure/spinner-frame-storage-mock';
import { ContentService } from './content-service';

const noopMedia: MediaLibraryPort = { list: () => [], find: () => undefined };
const SQUARE = { points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]] as [number, number][] };
const ZONE_ID = '3f2b8c1e-6a4d-4f0e-9b7a-2c5d8e1f0a3b';

/**
 * `mockHotelRepository` alone is the raw seed, with no CMS overlay merged in
 * — that merge is `durableHotelRepository`'s job, and it can't be imported
 * here (it pulls in `cloudflare-env.ts`, which needs a real Worker; see
 * `vitest.config.ts`'s own note on this). `updateSpinnerScene` writes a
 * `hotel`-kind overlay row, so reading it back needs the same merge
 * `durable-hotel-repository.ts#getHotel` does, replicated against the mock
 * port instead of the D1-or-mock one.
 */
const repository = {
  ...mockHotelRepository,
  async getHotel(slug: string): Promise<Hotel | null> {
    const seed = await mockHotelRepository.getHotel(slug);
    if (!seed) return null;
    const overlay = (await mockCatalogContentPort.listEntries('hotel', seed.id)) as CatalogEntryRecord<Hotel>[];
    return mergeCatalog([seed], overlay)[0] ?? seed;
  },
};

function makeService() {
  return new ContentService(
    repository,
    mockCatalogContentPort,
    noopMedia,
    mockSpinnerMarkupPort,
    mockSpinnerFrameStoragePort,
    demoHotel.slug,
    { hotel: new Set([demoHotel.id]), room: new Set(), unit: new Set(), rate: new Set(), addon: new Set() },
  );
}

function framesOf(count: number, urlPrefix = 'a') {
  return Array.from({ length: count }, (_, index) => ({ index, imageUrl: `/media/${urlPrefix}/${index}.webp` }));
}

describe('ContentService.updateSpinnerScene', () => {
  let service: ContentService;

  beforeEach(async () => {
    service = makeService();
    await service.resetContent();
  });

  it('changing only the key angles on the same frames preserves hotspots and zones', async () => {
    const before = await service.getSpinnerMarkupContent();
    const keyAngle = before!.keyAngles[0]!;
    await service.saveSpinnerZones(keyAngle, { upserts: [{ id: ZONE_ID, polygon: SQUARE, target: null }], deletes: [] });

    const result = await service.updateSpinnerScene(
      { frameWidth: before!.frameWidth, frameHeight: before!.frameHeight, frames: before!.frames, keyAngles: [0, 10, 20], startFrame: 10 },
      before!.version,
    );
    expect(result.ok).toBe(true);

    const after = await service.getSpinnerMarkupContent();
    expect(after!.keyAngles).toEqual([0, 10, 20]);
    expect(after!.startFrame).toBe(10);
    expect(after!.zones).toHaveLength(1); // untouched — same frames, so nothing invalidated it
  });

  it('replacing the frames resets hotspots, clears every zone, and sweeps the old frame set', async () => {
    const before = await service.getSpinnerMarkupContent();
    const keyAngle = before!.keyAngles[0]!;
    await service.saveSpinnerZones(keyAngle, { upserts: [{ id: ZONE_ID, polygon: SQUARE, target: null }], deletes: [] });

    await mockSpinnerFrameStoragePort.putFrame({
      hotelId: demoHotel.id,
      frameSetId: 'old-set',
      index: 0,
      contentType: 'image/webp',
      bytes: new ArrayBuffer(4),
    });

    const newFrames = framesOf(24, 'new-set');
    const result = await service.updateSpinnerScene(
      { frameWidth: 1280, frameHeight: 720, frames: newFrames, keyAngles: [0, 6, 12, 18], startFrame: 0 },
      before!.version,
      'old-set',
    );
    expect(result.ok).toBe(true);

    const after = await service.getSpinnerMarkupContent();
    expect(after!.frames).toEqual(newFrames);
    expect(after!.frameWidth).toBe(1280);
    expect(after!.zones).toHaveLength(0);

    // The old frame set's objects are gone from the store.
    expect(readMockFrame(`spinner/${demoHotel.id}/old-set/000.webp`)).toBeNull();
  });

  it('rejects a key angle outside the uploaded frames', async () => {
    const before = await service.getSpinnerMarkupContent();
    const result = await service.updateSpinnerScene(
      { frameWidth: before!.frameWidth, frameHeight: before!.frameHeight, frames: before!.frames, keyAngles: [0, 99999] },
      before!.version,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an empty frame set', async () => {
    const before = await service.getSpinnerMarkupContent();
    const result = await service.updateSpinnerScene(
      { frameWidth: before!.frameWidth, frameHeight: before!.frameHeight, frames: [], keyAngles: [] },
      before!.version,
    );
    expect(result.ok).toBe(false);
  });

  it('resetContent reverts to the seed frames and sweeps an uploaded set from storage', async () => {
    const before = await service.getSpinnerMarkupContent();

    const uploads = await Promise.all(
      [0, 1].map((index) => service.uploadSpinnerFrame('reset-me', index, 'image/webp', new ArrayBuffer(4))),
    );
    const frames = uploads.map((result, index) => {
      if (!result.ok) throw new Error('unreachable');
      return { index, imageUrl: result.value.url };
    });

    await service.updateSpinnerScene({ frameWidth: 640, frameHeight: 360, frames, keyAngles: [0, 1] }, before!.version);
    expect(readMockFrame(`spinner/${demoHotel.id}/reset-me/000.webp`)).not.toBeNull();

    await service.resetContent();

    const after = await service.getSpinnerMarkupContent();
    expect(after!.frames).toEqual(before!.frames);
    expect(after!.frameWidth).toBe(before!.frameWidth);
    expect(readMockFrame(`spinner/${demoHotel.id}/reset-me/000.webp`)).toBeNull();
  });

  it('rejects a version conflict', async () => {
    const before = await service.getSpinnerMarkupContent();
    const result = await service.updateSpinnerScene(
      { frameWidth: before!.frameWidth, frameHeight: before!.frameHeight, frames: before!.frames, keyAngles: before!.keyAngles },
      before!.version + 5,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('conflict');
  });
});

describe('ContentService.uploadSpinnerFrame', () => {
  let service: ContentService;

  beforeEach(async () => {
    service = makeService();
    await service.resetContent();
  });

  it('stores a valid frame and returns its url', async () => {
    const result = await service.uploadSpinnerFrame('set-1', 0, 'image/webp', new ArrayBuffer(8));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.url).toContain('set-1');
  });

  it('rejects an unsupported content type', async () => {
    const result = await service.uploadSpinnerFrame('set-1', 0, 'image/gif', new ArrayBuffer(8));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty file', async () => {
    const result = await service.uploadSpinnerFrame('set-1', 0, 'image/webp', new ArrayBuffer(0));
    expect(result.ok).toBe(false);
  });
});
