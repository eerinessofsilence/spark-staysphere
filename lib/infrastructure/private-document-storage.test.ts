import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ bucket: null as R2Bucket | null }));
vi.mock('./cloudflare-env', () => ({ getPrivateDocumentBucket: () => fixture.bucket }));
import { privateDocumentStorage } from './private-document-storage';

describe('private passport storage', () => {
  beforeEach(() => { fixture.bucket = null; });
  it('fails closed when no private bucket exists', async () => {
    await expect(privateDocumentStorage.put('documents/hotel/a', new ArrayBuffer(1), 'image/jpeg')).rejects.toThrow('unavailable');
    await expect(privateDocumentStorage.get('documents/hotel/a')).rejects.toThrow('unavailable');
    await expect(privateDocumentStorage.delete(['documents/hotel/a'])).rejects.toThrow('unavailable');
  });
  it('uses no-store metadata and deletes every derivative without creating public URLs', async () => {
    const put = vi.fn(); const remove = vi.fn();
    fixture.bucket = { put, delete: remove, get: vi.fn().mockResolvedValue(null) } as unknown as R2Bucket;
    const bytes = new ArrayBuffer(2);
    await privateDocumentStorage.put('documents/hotel/a', bytes, 'image/jpeg');
    expect(put).toHaveBeenCalledWith('documents/hotel/a', bytes, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' } });
    await privateDocumentStorage.delete(['documents/hotel/a', 'documents/hotel/a-thumb']);
    expect(remove).toHaveBeenCalledWith(['documents/hotel/a', 'documents/hotel/a-thumb']);
  });
});
