import { forwardPmsRequest } from '@/lib/application/pms-api';

/** PMS returns a thread only when the supplied email belongs to it. */
export async function GET(request: Request, context: RouteContext<'/api/conversations/[id]'>): Promise<Response> {
  const { id } = await context.params;
  const email = new URL(request.url).searchParams.get('email');
  const path = `/api/conversations/${encodeURIComponent(id)}${email ? `?email=${encodeURIComponent(email)}` : ''}`;
  return forwardPmsRequest(path, { method: 'GET' });
}
