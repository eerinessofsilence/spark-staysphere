import { beforeEach, describe, expect, it } from 'vitest';
import { ContentService } from './content-service';
import { mergeCatalog } from '../domain/catalog-overlay';
import type { CatalogEntryRecord, MediaLibraryPort } from '../domain/ports';
import type { RatePlan } from '../domain/schemas';
import { demoHotel, demoRooms } from '../infrastructure/mock-data';
import { mockHotelRepository } from '../infrastructure/mock-hotel-repository';
import { mockCatalogContentPort } from '../infrastructure/catalog-content-mock';
import { mockSpinnerMarkupPort } from '../infrastructure/spinner-markup-mock';
import { mockSpinnerFrameStoragePort } from '../infrastructure/spinner-frame-storage-mock';

const repository = {
  ...mockHotelRepository,
  async listRatePlans(roomTypeId: string) {
    const overlay = (await mockCatalogContentPort.listEntries('rate', demoHotel.id)) as CatalogEntryRecord<RatePlan>[];
    return mergeCatalog(await mockHotelRepository.listRatePlans(roomTypeId), overlay.filter((entry) => entry.data.roomTypeId === roomTypeId));
  },
};
const media: MediaLibraryPort = { list: async () => [], find: async () => undefined };
const service = () => new ContentService(
  repository,
  mockCatalogContentPort,
  media,
  mockSpinnerMarkupPort,
  mockSpinnerFrameStoragePort,
  demoHotel.slug,
  { hotel: new Set([demoHotel.id]), room: new Set(demoRooms.map((room) => room.id)), unit: new Set(), rate: new Set(), addon: new Set() },
);

describe('dated room rate edits', () => {
  beforeEach(async () => { await mockCatalogContentPort.reset(demoHotel.id); });

  it('saves one night, preserves other nights and can restore the base price', async () => {
    const room = demoRooms.find((candidate) => candidate.hotelId === demoHotel.id)!;
    const editor = service();
    const initial = (await editor.listRatesContent(room.id))[0]!;
    const first = await editor.updateRateDate(initial.id, room.id, '2026-12-24', 399.01, initial.version);
    expect(first.ok).toBe(true);
    const second = await editor.updateRateDate(initial.id, room.id, '2026-12-25', 410, first.ok ? first.value.version : 0);
    expect(second.ok).toBe(true);
    const stored = await mockCatalogContentPort.getEntry('rate', initial.id);
    expect(stored?.data).toMatchObject({ nightlyPriceOverrides: { '2026-12-24': 399.01, '2026-12-25': 410 } });
    const reset = await editor.updateRateDate(initial.id, room.id, '2026-12-24', null, second.ok ? second.value.version : 0);
    expect(reset.ok).toBe(true);
    expect((await mockCatalogContentPort.getEntry('rate', initial.id))?.data).toMatchObject({ nightlyPriceOverrides: { '2026-12-25': 410 } });
  });

  it('rejects invalid prices and stale edits without overwriting a saved night', async () => {
    const room = demoRooms.find((candidate) => candidate.hotelId === demoHotel.id)!;
    const editor = service();
    const initial = (await editor.listRatesContent(room.id))[0]!;
    expect((await editor.updateRateDate(initial.id, room.id, 'bad-date', 300, initial.version)).ok).toBe(false);
    expect((await editor.updateRateDate(initial.id, room.id, '2026-12-24', 0, initial.version)).ok).toBe(false);
    expect((await editor.updateRateDate(initial.id, room.id, '2026-12-24', 12.345, initial.version)).ok).toBe(false);
    expect((await editor.updateRateDate(initial.id, room.id, '2026-12-24', 300, initial.version)).ok).toBe(true);
    expect(await editor.updateRateDate(initial.id, room.id, '2026-12-24', 350, initial.version)).toMatchObject({ ok: false, error: { kind: 'conflict' } });
  });

  it('updates an inclusive range atomically and keeps dates outside it', async () => {
    const room = demoRooms.find((candidate) => candidate.hotelId === demoHotel.id)!;
    const editor = service();
    const initial = (await editor.listRatesContent(room.id))[0]!;
    const earlier = await editor.updateRateDate(initial.id, room.id, '2026-12-20', 333, initial.version);
    expect(earlier.ok).toBe(true);
    const version = earlier.ok ? earlier.value.version : 0;
    const result = await editor.updateRateDateRange(initial.id, room.id, '2026-12-24', '2026-12-26', 420.5, version);
    expect(result.ok).toBe(true);
    expect(((await mockCatalogContentPort.getEntry('rate', initial.id))?.data as RatePlan | undefined)?.nightlyPriceOverrides).toMatchObject({
      '2026-12-20': 333, '2026-12-24': 420.5, '2026-12-25': 420.5, '2026-12-26': 420.5,
    });
    expect(await editor.updateRateDateRange(initial.id, room.id, '2026-12-24', '2026-12-26', 430, version))
      .toMatchObject({ ok: false, error: { kind: 'conflict' } });
    const stored = ((await mockCatalogContentPort.getEntry('rate', initial.id))?.data as RatePlan | undefined)?.nightlyPriceOverrides;
    expect(stored?.['2026-12-25']).toBe(420.5);
    expect((await editor.updateRateDateRange(initial.id, room.id, '2026-12-26', '2026-12-24', 400, result.ok ? result.value.version : 0)).ok).toBe(false);
  });

  it('saves stay rules and close-outs without dropping dated prices', async () => {
    const room = demoRooms.find((candidate) => candidate.hotelId === demoHotel.id)!;
    const editor = service();
    const initial = (await editor.listRatesContent(room.id))[0]!;
    const price = await editor.updateRateDate(initial.id, room.id, '2026-12-24', 399, initial.version);
    expect(price.ok).toBe(true);
    const rules = await editor.updateRateStayRules(initial.id, room.id, { minimumStay: 2, maximumStay: 5 }, price.ok ? price.value.version : 0);
    expect(rules.ok).toBe(true);
    const close = await editor.updateRateCloseout(initial.id, room.id, '2026-12-25', true, rules.ok ? rules.value.version : 0);
    expect(close.ok).toBe(true);
    expect((await mockCatalogContentPort.getEntry('rate', initial.id))?.data).toMatchObject({
      minimumStay: 2, maximumStay: 5, closedDates: ['2026-12-25'],
      nightlyPriceOverrides: { '2026-12-24': 399 },
    });
    expect((await editor.updateRateStayRules(initial.id, room.id, { minimumStay: 6, maximumStay: 5 }, close.ok ? close.value.version : 0)).ok).toBe(false);
    expect((await editor.updateRateCloseout(initial.id, room.id, '2026-12-26', true, initial.version)).ok).toBe(false);
  });
});
