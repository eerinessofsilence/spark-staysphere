import { del, head, list, put } from '@vercel/blob';

/**
 * The slice of R2's bucket API this codebase uses — `put`, `get`, `head`,
 * `list`, `delete` — over Vercel Blob, so `media-library.ts` and
 * `spinner-frame-storage-r2.ts` run unchanged when the app is hosted on
 * Vercel. Two things R2 has that Blob does not are papered over here:
 *
 * - **Custom metadata.** A photo's filename and pixel size travel as a
 *   sidecar object at `<key>.meta.json`, written with the file and read on
 *   `head` and `list`. Sidecars are hidden from listings.
 * - **Keys.** Blob addresses objects by URL; the key is the pathname, kept
 *   verbatim (`addRandomSuffix: false`) so `/media/<key>` keeps working.
 *
 * Bodies are public on Blob — they are on R2 too, through `/media/*`.
 */

const SIDECAR = '.meta.json';

interface PutOptions {
  httpMetadata?: { contentType?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
}

interface ListOptions {
  prefix?: string;
  cursor?: string;
  limit?: number;
}

interface BlobObject {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata: { contentType?: string };
  customMetadata: Record<string, string>;
}

async function readSidecar(key: string): Promise<Record<string, string>> {
  const page = await list({ prefix: `${key}${SIDECAR}`, limit: 1 });
  const blob = page.blobs.find((entry) => entry.pathname === `${key}${SIDECAR}`);
  if (!blob) return {};
  try {
    const response = await fetch(blob.url, { cache: 'no-store' });
    return response.ok ? ((await response.json()) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export class BlobBucket {
  async put(key: string, value: ArrayBuffer | ArrayBufferView | string | ReadableStream, options: PutOptions = {}): Promise<void> {
    const cacheControl = options.httpMetadata?.cacheControl;
    const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
    await put(key, value as never, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: options.httpMetadata?.contentType,
      cacheControlMaxAge: maxAge ? Number(maxAge) : undefined,
    });
    if (options.customMetadata && Object.keys(options.customMetadata).length > 0) {
      await put(`${key}${SIDECAR}`, JSON.stringify(options.customMetadata), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
    }
  }

  async get(key: string): Promise<{ key: string; body: ReadableStream; httpMetadata: { contentType?: string } } | null> {
    const page = await list({ prefix: key, limit: 2 });
    const blob = page.blobs.find((entry) => entry.pathname === key);
    if (!blob) return null;
    const response = await fetch(blob.url);
    if (!response.ok || !response.body) return null;
    return { key, body: response.body, httpMetadata: { contentType: response.headers.get('content-type') ?? undefined } };
  }

  async head(key: string): Promise<BlobObject | null> {
    const page = await list({ prefix: key, limit: 2 });
    const blob = page.blobs.find((entry) => entry.pathname === key);
    if (!blob) return null;
    const details = await head(blob.url).catch(() => null);
    return {
      key,
      size: blob.size,
      uploaded: blob.uploadedAt,
      httpMetadata: { contentType: details?.contentType },
      customMetadata: await readSidecar(key),
    };
  }

  async list(options: ListOptions = {}): Promise<{ objects: BlobObject[]; truncated: boolean; cursor?: string }> {
    const page = await list({ prefix: options.prefix, cursor: options.cursor, limit: options.limit ?? 1000 });
    const files = page.blobs.filter((entry) => !entry.pathname.endsWith(SIDECAR));
    const objects: BlobObject[] = [];
    // Sidecars are fetched a handful at a time: an upload library is dozens of photos, not thousands.
    for (let i = 0; i < files.length; i += 16) {
      const chunk = files.slice(i, i + 16);
      const metas = await Promise.all(chunk.map((entry) => readSidecar(entry.pathname)));
      chunk.forEach((entry, index) => {
        objects.push({ key: entry.pathname, size: entry.size, uploaded: entry.uploadedAt, httpMetadata: {}, customMetadata: metas[index] });
      });
    }
    return { objects, truncated: page.hasMore, cursor: page.hasMore ? page.cursor : undefined };
  }

  async delete(keys: string | string[]): Promise<void> {
    const wanted = new Set(Array.isArray(keys) ? keys : [keys]);
    const urls: string[] = [];
    for (const key of wanted) {
      const page = await list({ prefix: key, limit: 4 });
      for (const blob of page.blobs) {
        if (blob.pathname === key || blob.pathname === `${key}${SIDECAR}`) urls.push(blob.url);
      }
    }
    if (urls.length > 0) await del(urls);
  }
}

/** Typed as R2 so `media-library.ts` and the spinner frame store need no second signature. */
export function createBlobBucket(): R2Bucket {
  return new BlobBucket() as unknown as R2Bucket;
}
