import { ContentService } from './content-service';
import { CatalogService } from './catalog-service';
import { catalogRepository } from '../infrastructure/catalog-repository';
import { durableCatalogContentPort } from '../infrastructure/durable-catalog-content';
import { durableSpinnerMarkupPort } from '../infrastructure/durable-spinner-markup';
import { durableSpinnerFrameStoragePort } from '../infrastructure/durable-spinner-frame-storage';
import { mediaLibraryPort } from '../infrastructure/media-library';
import { getAdminAuthEnv, getGuestAppUrl, getMediaBucket, getOpenAiKey } from '../infrastructure/cloudflare-env';
import { demoHotel, demoRooms, demoPhysicalRooms, demoRates, demoAddOns } from '../infrastructure/mock-data';
import { readMockFrame } from '../infrastructure/spinner-frame-storage-mock';
import { createOpenAiRoomRecognizer } from '../infrastructure/openai-room-recognizer';
import { createOpenAiProductRecognizer } from '../infrastructure/openai-product-recognizer';
import type { ProductRecognizer, RoomRecognizer, CatalogEntryKind } from '../domain/ports';

export const DEMO_HOTEL_SLUG = demoHotel.slug;
export const hotelRepository = catalogRepository;
export const catalogService = new CatalogService(catalogRepository, durableSpinnerMarkupPort);
export const guestAppUrl = getGuestAppUrl;
const seedIds: Record<CatalogEntryKind, ReadonlySet<string>> = {
  hotel: new Set([demoHotel.id]), room: new Set(demoRooms.map((room) => room.id)), unit: new Set(demoPhysicalRooms.map((room) => room.id)),
  rate: new Set(demoRates.map((rate) => rate.id)), addon: new Set(demoAddOns.map((addon) => addon.id)),
};
export const contentService = new ContentService(catalogRepository, durableCatalogContentPort, mediaLibraryPort, durableSpinnerMarkupPort,
  durableSpinnerFrameStoragePort, DEMO_HOTEL_SLUG, seedIds, async (permission) => {
    const { requirePermission } = await import('./admin-session');
    await requirePermission(permission);
  });
export const roomRecognizer: { recognize(input: Parameters<RoomRecognizer['recognize']>[0]): Promise<Awaited<ReturnType<RoomRecognizer['recognize']>> | null> } = {
  async recognize(input) {
    const key = getOpenAiKey();
    if (!key) return null;
    try { return await createOpenAiRoomRecognizer(key).recognize(input); }
    catch (error) { console.error('Room recognition unavailable', error); return null; }
  },
};
export const productRecognizer: { recognize(input: Parameters<ProductRecognizer['recognize']>[0]): Promise<Awaited<ReturnType<ProductRecognizer['recognize']>> | null> } = {
  async recognize(input) {
    const key = getOpenAiKey();
    if (!key) return null;
    try { return await createOpenAiProductRecognizer(key).recognize(input); }
    catch (error) { console.error('Product recognition unavailable', error); return null; }
  },
};
export function adminAuthConfig() {
  const { password, editorPassword, sessionSecret } = getAdminAuthEnv();
  if (process.env.NODE_ENV === 'production' && (!password || !sessionSecret || sessionSecret.length < 32)) throw new Error('Configure ADMIN_PASSWORD and ADMIN_SESSION_SECRET (32+ characters) for production.');
  return { password: password ?? 'staysphere', editorPassword, sessionSecret: sessionSecret ?? 'independent-cms-local-session-secret-2026', demo: password === null };
}
export async function readMediaObject(key: string): Promise<{ contentType: string; body: ReadableStream | ArrayBuffer } | null> {
  const bucket = getMediaBucket();
  if (bucket) { const object = await bucket.get(key); return object ? { contentType: object.httpMetadata?.contentType ?? 'application/octet-stream', body: object.body } : null; }
  const frame = readMockFrame(key);
  return frame ? { contentType: frame.contentType, body: frame.bytes } : null;
}
