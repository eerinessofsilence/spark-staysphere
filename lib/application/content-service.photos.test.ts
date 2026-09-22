import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAsset, MediaLibraryPort } from "../domain/ports";
import { MAX_PHOTO_BYTES } from "../domain/photo-upload";
import { demoHotel } from "../infrastructure/mock-data";
import { mockHotelRepository } from "../infrastructure/mock-hotel-repository";
import { mockCatalogContentPort } from "../infrastructure/catalog-content-mock";
import { mockSpinnerMarkupPort } from "../infrastructure/spinner-markup-mock";
import { mockSpinnerFrameStoragePort } from "../infrastructure/spinner-frame-storage-mock";
import { ContentService } from "./content-service";

const photo = readFileSync("public/images/hotel/cove.webp");
const bytes = Uint8Array.from(photo).buffer;
const asset: MediaAsset = {
  url: "/media/photos/hotel/test.webp",
  folder: "uploads",
  filename: "test.webp",
  width: 2000,
  height: 3000,
  bytes: bytes.byteLength,
};
const upload = vi.fn(async () => asset);
const media: MediaLibraryPort = {
  list: async () => [asset],
  find: async (url) => (url === asset.url ? asset : undefined),
  upload,
};
const makeService = (authorize = async (_permission: string) => {}) =>
  new ContentService(
    mockHotelRepository,
    mockCatalogContentPort,
    media,
    mockSpinnerMarkupPort,
    mockSpinnerFrameStoragePort,
    demoHotel.slug,
    {
      hotel: new Set([demoHotel.id]),
      room: new Set(),
      unit: new Set(),
      rate: new Set(),
      addon: new Set(),
    },
    undefined,
    authorize,
  );

describe("photo uploads and hotel gallery", () => {
  beforeEach(async () => {
    upload.mockClear();
    await mockCatalogContentPort.reset(demoHotel.id);
  });

  it("validates photo bytes and derives dimensions before storing an upload", async () => {
    const result = await makeService().uploadPhoto("coast.webp", "image/webp", bytes);
    expect(result).toEqual({ ok: true, value: asset });
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ hotelId: demoHotel.id, width: 2000, height: 3000 }),
    );
  });

  it("rejects disguised files and oversized uploads without writing them", async () => {
    const service = makeService();
    expect(
      (
        await service.uploadPhoto(
          "fake.webp",
          "image/webp",
          new TextEncoder().encode("<svg/>").buffer,
        )
      ).ok,
    ).toBe(false);
    expect(
      (await service.uploadPhoto("huge.webp", "image/webp", new ArrayBuffer(MAX_PHOTO_BYTES + 1)))
        .ok,
    ).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("checks permissions before writing media", async () => {
    const service = makeService(async () => {
      const error = new Error("Denied");
      error.name = "AdminPermissionError";
      throw error;
    });
    expect(await service.uploadPhoto("coast.webp", "image/webp", bytes)).toMatchObject({
      ok: false,
      error: { kind: "forbidden" },
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("persists resolved gallery dimensions and the first photo as the cover", async () => {
    const input = {
      ...demoHotel,
      aboutPhoto: asset.url,
      aboutPhotos: [asset.url],
      facilities: [],
      areas: [],
    };
    expect((await makeService().updateHotel(input, 0)).ok).toBe(true);
    const entry = await mockCatalogContentPort.getEntry("hotel", demoHotel.id);
    expect(entry?.data).toMatchObject({
      aboutPhoto: { url: asset.url },
      aboutPhotos: [{ url: asset.url, width: 2000, height: 3000 }],
    });
  });

  it("rejects unknown gallery URLs and an empty gallery", async () => {
    const input = { ...demoHotel, aboutPhoto: asset.url, facilities: [], areas: [] };
    expect(
      (
        await makeService().updateHotel(
          { ...input, aboutPhotos: [asset.url, "https://example.com/photo.png"] },
          0,
        )
      ).ok,
    ).toBe(false);
    expect((await makeService().updateHotel({ ...input, aboutPhotos: [] }, 0)).ok).toBe(false);
    expect(await mockCatalogContentPort.getEntry("hotel", demoHotel.id)).toBeNull();
  });

  it('resolves a single area photo while preserving its hotspots and validates its URL', async () => {
    const area = demoHotel.areas[0]!;
    const input = { ...demoHotel, aboutPhoto: asset.url, facilities: [], areas: [{ ...area, photoUrl: asset.url, photoAlt: 'New description' }] };
    const service = makeService();
    expect((await service.updateHotel(input, 0)).ok).toBe(true);
    const entry = await mockCatalogContentPort.getEntry('hotel', demoHotel.id);
    const hotel = entry!.data as typeof demoHotel;
    expect(hotel.areas[0]?.photo).toEqual({ url: asset.url, width: 2000, height: 3000, alt: 'New description' });
    expect(hotel.areas[0]?.hotspots).toEqual(area.hotspots);
    const bad = await service.updateHotel({ ...input, areas: [{ ...input.areas[0], photoUrl: 'https://example.com/unknown.jpg' }] }, 1);
    expect(bad).toMatchObject({ ok: false, error: { kind: 'validation', fieldErrors: { [`areas.${area.id}.photoUrl`]: expect.any(Array) } } });
  });
});
