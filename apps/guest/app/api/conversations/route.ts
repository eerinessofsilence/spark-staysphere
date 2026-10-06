import { forwardPmsRequest } from '@/lib/application/pms-api';

/** Same-origin proxy; PMS validates the reference, guest email, and message. */
export async function POST(request: Request): Promise<Response> {
  return forwardPmsRequest('/api/conversations', {
    method: 'POST',
    headers: { 'content-type': request.headers.get('content-type') ?? 'application/json' },
    body: await request.text(),
  });
}
