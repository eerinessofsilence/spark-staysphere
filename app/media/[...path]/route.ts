import { getMediaBucket } from '@/lib/infrastructure/cloudflare-env';
import { readMockFrame } from '@/lib/infrastructure/spinner-frame-storage-mock';

/**
 * GET /media/<key> — public, unauthenticated: streams one object out of the
 * `MEDIA` R2 bucket (or, without an R2 binding, the in-memory fallback
 * `spinner-frame-storage-mock.ts` writes to). Every key currently in the
 * bucket is a `spinner/<hotelId>/<frameSetId>/<NNN>.<ext>` frame — see
 * `lib/infrastructure/spinner-frame-storage-r2.ts#frameKey` — hence the
 * prefix check; this route is not a general file server.
 *
 * `Cache-Control: immutable` is safe because a frame set's key includes its
 * own `frameSetId`: replacing the frames a hotel uploaded gets a new id, it
 * never overwrites an old key in place.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const key = path.join('/');
  if (!key.startsWith('spinner/')) return new Response('Not found', { status: 404 });

  const bucket = getMediaBucket();
  if (bucket) {
    const object = await bucket.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const local = readMockFrame(key);
  if (!local) return new Response('Not found', { status: 404 });
  return new Response(local.bytes, {
    headers: { 'Content-Type': local.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
