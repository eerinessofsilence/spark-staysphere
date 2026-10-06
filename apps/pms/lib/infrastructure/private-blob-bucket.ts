import { del, get, put } from '@vercel/blob';

/** Separate private Blob store and token. No public URL is returned or persisted. */
export function createPrivateBlobBucket(token: string): R2Bucket {
  return {
    async put(key: string, bytes: ArrayBuffer, options: { httpMetadata?: { contentType?: string } }) {
      await put(key, bytes, { token, access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: options.httpMetadata?.contentType });
    },
    async get(key: string) {
      const result = await get(key, { token, access: 'private', useCache: false });
      return result?.statusCode === 200 ? { body: result.stream, httpMetadata: { contentType: result.blob.contentType } } : null;
    },
    async delete(keys: string | string[]) { await del(keys, { token }); },
  } as unknown as R2Bucket;
}
