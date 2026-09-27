import { communicationsService, DEMO_HOTEL_SLUG } from '@/lib/application/container';

/**
 * GET /api/conversations/:id?email=… — a guest's own thread, for the chat on
 * their confirmation page to poll. The id alone opens nothing: `email` must
 * be the one the thread was opened under, the same rule as
 * `GET /api/bookings/:reference`. Reading never marks anything as seen —
 * only the desk opening the thread does that.
 */
export async function GET(request: Request, context: RouteContext<'/api/conversations/[id]'>): Promise<Response> {
  const { id } = await context.params;
  const email = new URL(request.url).searchParams.get('email');
  const notFound = () => Response.json({ error: 'not_found', message: 'No conversation found.' }, { status: 404 });
  if (!email) return notFound();
  const thread = await communicationsService.guestThread(DEMO_HOTEL_SLUG, id, email);
  if (!thread) return notFound();
  return Response.json(
    { conversationId: thread.conversation.id, messages: thread.messages },
    { headers: { 'cache-control': 'no-store' } },
  );
}
