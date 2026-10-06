import type { SpinnerMarkupPort } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './spinner-markup-d1';
import { mockSpinnerMarkupPort } from './spinner-markup-mock';

/**
 * The spinner-markup port the app actually uses. Resolves the D1 binding at
 * call time — never once at module load — and reads through D1 when one is
 * configured, falling back to the in-memory mock otherwise. Same shape as
 * `durable-catalog-content.ts`.
 */
export const durableSpinnerMarkupPort: SpinnerMarkupPort = {
  listZones(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.listZones(db, hotelId) : mockSpinnerMarkupPort.listZones(hotelId);
  },
  applyZoneBatch(hotelId, batch) {
    const db = getDemoDatabase();
    return db ? d1.applyZoneBatch(db, hotelId, batch) : mockSpinnerMarkupPort.applyZoneBatch(hotelId, batch);
  },
  reset(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.reset(db, hotelId) : mockSpinnerMarkupPort.reset(hotelId);
  },
};
