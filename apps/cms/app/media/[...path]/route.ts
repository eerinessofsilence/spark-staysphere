import { readMediaObject } from '@/lib/application/container';
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const key = (await context.params).path.join('/');
  if (!/^(spinner|photos|panoramas)\//.test(key) || key.split('/').some((part) => part === '..' || part === '.')) return new Response('Not found', { status: 404 });
  const object = await readMediaObject(key);
  return object ? new Response(object.body, { headers: { 'Content-Type': object.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' } }) : new Response('Not found', { status: 404 });
}
