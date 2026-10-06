import type { PrivateDocumentStorage } from '@/lib/domain/guest-document';
import { getPrivateDocumentBucket } from './cloudflare-env';

/** Never fall back to the public media adapter or to persisted base64 in the database. */
export const privateDocumentStorage: PrivateDocumentStorage = {
  async put(key, bytes, contentType) {
    const bucket = getPrivateDocumentBucket();
    if (!bucket) throw new Error('Private document storage is unavailable.');
    await bucket.put(key, bytes, { httpMetadata: { contentType, cacheControl: 'private, no-store' } });
  },
  async get(key) {
    const bucket = getPrivateDocumentBucket();
    if (!bucket) throw new Error('Private document storage is unavailable.');
    const object = await bucket.get(key);
    return object ? { body: object.body, contentType: object.httpMetadata?.contentType ?? 'image/jpeg' } : null;
  },
  async delete(keys) {
    const bucket = getPrivateDocumentBucket();
    if (!bucket) throw new Error('Private document storage is unavailable.');
    if (keys.length) await bucket.delete(keys);
  },
};
