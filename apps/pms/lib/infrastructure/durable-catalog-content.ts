import type { CatalogContentPort } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './catalog-content-d1';
import { mockCatalogContentPort } from './catalog-content-mock';

/**
 * The CMS overlay port the app actually uses. Resolves the D1 binding at
 * call time — never once at module load, since `env` bindings are only
 * guaranteed once a request is in flight — and reads through D1 when one is
 * configured, falling back to the in-memory mock otherwise. Same shape as
 * `durable-hotel-repository.ts`.
 */
export const durableCatalogContentPort: CatalogContentPort = {
  getEntry(kind, id) {
    const db = getDemoDatabase();
    return db ? d1.getEntry(db, kind, id) : mockCatalogContentPort.getEntry(kind, id);
  },
  listEntries(kind, hotelId) {
    const db = getDemoDatabase();
    return db ? d1.listEntries(db, kind, hotelId) : mockCatalogContentPort.listEntries(kind, hotelId);
  },
  upsertEntry(input) {
    const db = getDemoDatabase();
    return db ? d1.upsertEntry(db, input) : mockCatalogContentPort.upsertEntry(input);
  },
  deleteEntry(kind, id, expectedVersion) {
    const db = getDemoDatabase();
    return db
      ? d1.deleteEntry(db, kind, id, expectedVersion)
      : mockCatalogContentPort.deleteEntry(kind, id, expectedVersion);
  },
  reset(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.reset(db, hotelId) : mockCatalogContentPort.reset(hotelId);
  },
};
