import type { SpinnerMarkupPort } from '../domain/ports';
import type { SpinnerZone } from '../domain/spinner-markup';

/**
 * Process-local zone store: the fallback used whenever no D1 binding is
 * configured (see `durable-spinner-markup.ts`), mirroring the D1 semantics
 * in `spinner-markup-d1.ts` so the two backends can't disagree.
 */
const store = new Map<string, SpinnerZone>();

export const mockSpinnerMarkupPort: SpinnerMarkupPort = {
  async listZones(hotelId) {
    return [...store.values()]
      .filter((zone) => zone.hotelId === hotelId)
      .sort((a, b) => a.frameIndex - b.frameIndex || a.id.localeCompare(b.id));
  },
  async applyZoneBatch(hotelId, { upserts, deletes }) {
    for (const id of deletes) {
      const existing = store.get(id);
      if (existing?.hotelId === hotelId) store.delete(id);
    }
    for (const row of upserts) {
      const existing = store.get(row.id);
      // Same guard as the D1 adapter's `WHERE hotel_id = excluded.hotel_id`:
      // an id belonging to another hotel is left untouched, never hijacked.
      if (existing && existing.hotelId !== hotelId) continue;
      store.set(row.id, {
        id: row.id,
        hotelId,
        frameIndex: row.frameIndex,
        polygon: row.polygon,
        target: row.target,
        updatedAt: new Date().toISOString(),
      });
    }
  },
  async reset(hotelId) {
    for (const [id, zone] of store) {
      if (zone.hotelId === hotelId) store.delete(id);
    }
  },
};
