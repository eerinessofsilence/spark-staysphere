import { describe, expect, it, vi } from 'vitest';
const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn().mockResolvedValue(null), del: vi.fn() }));
vi.mock('@vercel/blob', () => blob);
import { createPrivateBlobBucket } from './private-blob-bucket';

describe('private Blob adapter', () => {
  it('uses the private token and access mode; bypasses CDN on reads', async () => {
    const bucket = createPrivateBlobBucket('test-private-token');
    await bucket.put('documents/test', new ArrayBuffer(1), { httpMetadata: { contentType: 'image/jpeg' } });
    expect(blob.put).toHaveBeenCalledWith('documents/test', expect.any(ArrayBuffer), expect.objectContaining({ access: 'private', token: 'test-private-token', addRandomSuffix: false }));
    await bucket.get('documents/test');
    expect(blob.get).toHaveBeenCalledWith('documents/test', { access: 'private', token: 'test-private-token', useCache: false });
    await bucket.delete(['documents/test']);
    expect(blob.del).toHaveBeenCalledWith(['documents/test'], { token: 'test-private-token' });
  });
});
