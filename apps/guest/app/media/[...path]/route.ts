import { cmsOrigin } from '@/lib/application/cms-api';

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path;
  if (!parts.length || !['spinner', 'photos', 'panoramas'].includes(parts[0]!) || parts.some((part) => part === '.' || part === '..' || /[\\/]/.test(part))) return new Response('Not found', { status: 404 });
  try {
    const response = await fetch(`${cmsOrigin()}/media/${parts.map(encodeURIComponent).join('/')}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return new Response('Media unavailable', { status: response.status });
    return new Response(response.body, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Media unavailable', { status: 503 }); }
}
