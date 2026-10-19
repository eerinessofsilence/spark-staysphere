import type { SpinnerFrameStoragePort } from '../domain/ports';
import { getMediaBucket } from './cloudflare-env';
import * as r2 from './spinner-frame-storage-r2';
import { mockSpinnerFrameStoragePort } from './spinner-frame-storage-mock';

/**
 * The frame-storage port the app actually uses. Resolves the R2 binding at
 * call time — never once at module load — and reads/writes through R2 when
 * one is configured, falling back to the in-memory mock otherwise. Same
 * shape as `durable-catalog-content.ts`/`durable-spinner-markup.ts`.
 */
export const durableSpinnerFrameStoragePort: SpinnerFrameStoragePort = {
  putFrame(input) {
    const bucket = getMediaBucket();
    return bucket ? r2.putFrame(bucket, input) : mockSpinnerFrameStoragePort.putFrame(input);
  },
  deleteFrameSet(hotelId, frameSetId) {
    const bucket = getMediaBucket();
    return bucket
      ? r2.deleteFrameSet(bucket, hotelId, frameSetId)
      : mockSpinnerFrameStoragePort.deleteFrameSet(hotelId, frameSetId);
  },
};
