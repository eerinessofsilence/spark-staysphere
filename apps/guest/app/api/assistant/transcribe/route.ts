import { forwardPmsRequest } from '@/lib/application/pms-api';

/** Compatibility proxy; PMS owns speech transcription and enforces its limits. */
export async function POST(request: Request): Promise<Response> {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const clientIp = request.headers.get('cf-connecting-ip');
  if (contentType) headers.set('content-type', contentType);
  if (clientIp) headers.set('cf-connecting-ip', clientIp);
  return forwardPmsRequest('/api/assistant/transcribe', {
    method: 'POST', headers, body: await request.arrayBuffer(),
  });
}
