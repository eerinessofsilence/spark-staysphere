import { forwardPmsRequest } from '@/lib/application/pms-api';

/** Compatibility proxy; PMS is authoritative for price and availability. */
export async function POST(request: Request): Promise<Response> {
  return forwardPmsRequest('/api/quotes', {
    method: 'POST',
    headers: { 'content-type': request.headers.get('content-type') ?? 'application/json' },
    body: await request.text(),
  });
}
