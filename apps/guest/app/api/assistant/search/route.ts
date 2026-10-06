import { forwardPmsRequest } from '@/lib/application/pms-api';

/** Compatibility proxy; PMS owns catalog-aware assistant search. */
export async function POST(request: Request): Promise<Response> {
  const headers = new Headers({ 'content-type': request.headers.get('content-type') ?? 'application/json' });
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('cf-connecting-ip', clientIp);
  return forwardPmsRequest('/api/assistant/search', {
    method: 'POST', headers, body: await request.text(),
  });
}
