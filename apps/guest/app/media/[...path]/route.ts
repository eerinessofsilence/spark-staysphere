import { forwardPmsRequest } from '@/lib/application/pms-api';

/**
 * GET /media/<key> — public, unauthenticated: streams one object out of the
 * `MEDIA` R2 bucket on PMS. The route keeps the relative `/media` URL used by
 * the site, validates the public key prefixes, and proxies bytes from PMS so
 * Guest does not need its own media store. Every key currently in
 * the bucket is a `spinner/<hotelId>/<frameSetId>/<NNN>.<ext>` frame, hence
 * the prefix check; `photos/` additionally serves validated CMS photo uploads.
 *
 * `Cache-Control: immutable` is safe because a frame set's key includes its
 * own `frameSetId`: replacing the frames a hotel uploaded gets a new id, it
 * never overwrites an old key in place.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const key = path.join('/');
  if (!key.startsWith('spinner/') && !key.startsWith('photos/') && !key.startsWith('panoramas/')) {
    return new Response('Not found', { status: 404 });
  }

  const response = await forwardPmsRequest(`/media/${key.split('/').map(encodeURIComponent).join('/')}`, { method: 'GET' });
  if (!response.ok) return new Response('Not found', { status: response.status });
  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': response.headers.get('cache-control') ?? 'public, max-age=31536000, immutable',
    },
  });
}
