import type { SpinnerFrameStoragePort } from '../domain/ports';
import { frameKey } from './spinner-frame-storage-r2';

/**
 * Process-local frame storage: the fallback used whenever no R2 binding is
 * configured, mirroring the R2 adapter's key scheme so the two backends
 * serve identical URLs. Bytes are held in memory only — they don't survive
 * a restart, same limitation the D1-less fallback has for everything else.
 */
const store = new Map<string, { contentType: string; bytes: ArrayBuffer }>();

export const mockSpinnerFrameStoragePort: SpinnerFrameStoragePort = {
  async putFrame({ hotelId, frameSetId, index, contentType, bytes }) {
    const key = frameKey(hotelId, frameSetId, index, contentType);
    store.set(key, { contentType, bytes });
    return `/media/${key}`;
  },
  async deleteFrameSet(hotelId, frameSetId) {
    const prefix = `spinner/${hotelId}/${frameSetId}/`;
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
};

/** Read back by `app/media/[...path]/route.ts` when there is no R2 binding. */
export function readMockFrame(key: string): { contentType: string; bytes: ArrayBuffer } | null {
  return store.get(key) ?? null;
}
