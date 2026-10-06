import type {
  CatalogContentPort,
  CatalogDeleteResult,
  CatalogEntryKind,
  CatalogEntryRecord,
  CatalogUpsertResult,
} from '../domain/ports';

/**
 * Process-local overlay store: the fallback used whenever no D1 binding is
 * configured (see `durable-catalog-content.ts`), mirroring the D1 semantics
 * in `catalog-content-d1.ts` exactly so the two backends can't disagree.
 */
const store = new Map<CatalogEntryKind, Map<string, CatalogEntryRecord>>();

function bucket(kind: CatalogEntryKind): Map<string, CatalogEntryRecord> {
  let map = store.get(kind);
  if (!map) {
    map = new Map();
    store.set(kind, map);
  }
  return map;
}

export const mockCatalogContentPort: CatalogContentPort = {
  async getEntry(kind, id) {
    return bucket(kind).get(id) ?? null;
  },
  async listEntries(kind, hotelId) {
    return [...bucket(kind).values()].filter((entry) => entry.hotelId === hotelId);
  },
  async upsertEntry({ kind, id, hotelId, data, expectedVersion }): Promise<CatalogUpsertResult> {
    const map = bucket(kind);
    const existing = map.get(id);
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      return { ok: false, conflict: true, currentVersion };
    }
    const version = currentVersion + 1;
    map.set(id, { kind, id, hotelId, data, version, updatedAt: new Date().toISOString() });
    return { ok: true, version };
  },
  async deleteEntry(kind, id, expectedVersion): Promise<CatalogDeleteResult> {
    const map = bucket(kind);
    const existing = map.get(id);
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      return { ok: false, conflict: true, currentVersion };
    }
    map.delete(id);
    return { ok: true };
  },
  async reset(hotelId) {
    for (const map of store.values()) {
      for (const [id, entry] of map) {
        if (entry.hotelId === hotelId) map.delete(id);
      }
    }
  },
};
