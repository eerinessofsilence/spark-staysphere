import { readMediaObject } from '@/lib/application/container';

/**
 * GET /media/<key> — public, unauthenticated: streams one object out of the
 * `MEDIA` R2 bucket (or, without an R2 binding, the in-memory fallback) via
 * `container.ts#readMediaObject` — this route never imports
 * `lib/infrastructure` directly (see CLAUDE.md's "container.ts is the only
 * module that may import lib/infrastructure" rule). Every key currently in
 * the bucket is a `spinner/<hotelId>/<frameSetId>/<NNN>.<ext>` frame — see
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

  const object = await readMediaObject(key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: { 'Content-Type': object.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
