import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Blob-backed bucket against a fake `@vercel/blob`: keys stay verbatim,
 * custom metadata rides in a sidecar that listings hide and `head` reads
 * back, and a delete takes the sidecar with it.
 */
interface Stored { pathname: string; body: string; contentType?: string; uploadedAt: Date }
const store = new Map<string, Stored>();
const urlOf = (pathname: string) => `https://blob.test/${pathname}`;

vi.mock('@vercel/blob', () => ({
  put: async (pathname: string, body: string | ArrayBuffer, options: { contentType?: string }) => {
    store.set(pathname, { pathname, body: typeof body === 'string' ? body : `[${(body as ArrayBuffer).byteLength} bytes]`, contentType: options.contentType, uploadedAt: new Date('2026-09-25T00:00:00Z') });
    return { url: urlOf(pathname), pathname };
  },
  list: async ({ prefix = '', limit = 1000 }: { prefix?: string; limit?: number }) => {
    const blobs = [...store.values()].filter((entry) => entry.pathname.startsWith(prefix)).slice(0, limit)
      .map((entry) => ({ pathname: entry.pathname, url: urlOf(entry.pathname), size: entry.body.length, uploadedAt: entry.uploadedAt }));
    return { blobs, hasMore: false, cursor: undefined };
  },
  head: async (url: string) => {
    const entry = store.get(url.replace('https://blob.test/', ''));
    return entry ? { contentType: entry.contentType } : null;
  },
  del: async (urls: string[]) => {
    for (const url of urls) store.delete(url.replace('https://blob.test/', ''));
  },
}));

const { BlobBucket } = await import('./blob-r2');

describe('BlobBucket', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('fetch', async (url: string) => {
      const entry = store.get(String(url).replace('https://blob.test/', ''));
      return entry ? new Response(entry.body, { status: 200, headers: { 'content-type': entry.contentType ?? 'application/octet-stream' } }) : new Response('', { status: 404 });
    });
  });

  it('keeps metadata in a hidden sidecar and hands it back on head and list', async () => {
    const bucket = new BlobBucket();
    await bucket.put('photos/h1/a.webp', new ArrayBuffer(10), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' },
      customMetadata: { filename: 'sea.webp', width: '1600', height: '1200' },
    });
    expect([...store.keys()]).toEqual(['photos/h1/a.webp', 'photos/h1/a.webp.meta.json']);
    const listed = await bucket.list({ prefix: 'photos/' });
    expect(listed.objects.map((object) => object.key)).toEqual(['photos/h1/a.webp']);
    expect(listed.objects[0].customMetadata).toEqual({ filename: 'sea.webp', width: '1600', height: '1200' });
    expect((await bucket.head('photos/h1/a.webp'))?.customMetadata.width).toBe('1600');
    expect(await bucket.head('photos/h1/missing.webp')).toBeNull();
  });

  it('streams a body back with its content type, and deletes the sidecar with the object', async () => {
    const bucket = new BlobBucket();
    await bucket.put('spinner/h1/set/000.webp', 'frame', { httpMetadata: { contentType: 'image/webp' } });
    const object = await bucket.get('spinner/h1/set/000.webp');
    expect(object?.httpMetadata.contentType).toBe('image/webp');
    expect(await new Response(object!.body).text()).toBe('frame');
    await bucket.put('photos/h1/b.webp', 'x', { customMetadata: { filename: 'b' } });
    await bucket.delete(['photos/h1/b.webp', 'spinner/h1/set/000.webp']);
    expect([...store.keys()]).toEqual([]);
    expect(await bucket.get('spinner/h1/set/000.webp')).toBeNull();
  });
});
