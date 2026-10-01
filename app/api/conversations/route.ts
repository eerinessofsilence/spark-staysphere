import { z } from 'zod';
import { communicationsService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { MESSAGE_MAX } from '@/lib/application/communications-service';
import { parseJsonBody } from '../_lib/http';

const bodySchema = z.object({
  /** The stay this is about — the confirmation page always sends it, so the thread is that booking's. */
  reference: z.string().trim().min(1).optional(),
  name: z.string().trim().max(120).optional().default(''),
  email: z.string().trim().email(),
  body: z.string().trim().min(1).max(MESSAGE_MAX),
});

/**
 * POST /api/conversations — a guest writes to the hotel from the site.
 *
 * Files the message as the site's chat channel and answers with the thread
 * it landed in, so the page can keep polling `GET /api/conversations/:id`.
 * A reference is only honoured when it belongs to the email given, the same
 * rule the booking lookup enforces; a mismatch fails as a bad request rather
 * than opening a thread under someone else's stay.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const parsed = await parseJsonBody(request, bodySchema, 'Send an email address and a message.');
  if (!parsed.ok) return parsed.response;
  const { reference, name, email, body } = parsed.data;
  let result;
  try {
    result = await communicationsService.receive(DEMO_HOTEL_SLUG, {
    channel: 'chat',
    name,
    email,
    bookingReference: reference ?? null,
    body,
    });
  } catch (error) {
    console.error('Guest conversation request failed', { route: '/api/conversations', code: 'internal_error', requestId }, error);
    return Response.json({ error: 'unavailable', message: 'The message could not be filed.', requestId }, { status: 503 });
  }
  if (!result.ok) {
    return Response.json({ error: result.error, message: 'The message could not be filed.' }, { status: 400 });
  }
  return Response.json({ conversationId: result.conversation.id, message: result.message }, { status: 201 });
}
