import { z } from 'zod';
import { communicationsService, DEMO_HOTEL_SLUG, inboundEmailAuthorized } from '@/lib/application/container';
import { MESSAGE_MAX } from '@/lib/application/communications-service';
import { parseJsonBody } from '../../_lib/http';

/** What an inbound-mail relay hands over once it has parsed the message — the fields every provider's "inbound parse" webhook can produce. */
const bodySchema = z.object({
  from: z.object({ email: z.string().trim().email(), name: z.string().trim().max(120).optional().default('') }),
  subject: z.string().trim().max(200).optional().default(''),
  text: z.string().trim().min(1).max(MESSAGE_MAX),
  /** A booking reference the relay found in the subject or body, if any. */
  reference: z.string().trim().min(1).optional(),
});

/**
 * POST /api/inbound/email — a guest's email, relayed by whatever receives
 * the hotel's mail (Cloudflare Email Routing into a Worker, or a provider's
 * inbound-parse webhook such as SendGrid's or Mailgun's), filed into
 * `/admin/communications` as an email-channel thread.
 *
 * Closed unless the relay presents the shared secret in `x-inbound-secret`,
 * and closed entirely while no `INBOUND_EMAIL_SECRET` is configured: an
 * open endpoint would let anyone plant "guest" mail in the desk's inbox.
 * A reference is honoured only when it belongs to the sender's address;
 * otherwise the mail is filed without one rather than refused.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!inboundEmailAuthorized(request.headers.get('x-inbound-secret'))) {
    return Response.json({ error: 'unauthorized', message: 'Inbound email is not enabled for this caller.' }, { status: 401 });
  }
  const parsed = await parseJsonBody(request, bodySchema, 'Send the sender, the text and, if known, the booking reference.');
  if (!parsed.ok) return parsed.response;
  const { from, subject, text, reference } = parsed.data;
  const body = subject && !text.startsWith(subject) ? `${subject}\n\n${text}` : text;

  const file = (bookingReference: string | null) =>
    communicationsService.receive(DEMO_HOTEL_SLUG, { channel: 'email', name: from.name, email: from.email, bookingReference, body });
  let result;
  try {
    result = await file(reference ?? null);
    if (!result.ok && result.error === 'bookingMismatch') result = await file(null);
  } catch (error) {
    console.error('Inbound email request failed', { route: '/api/inbound/email', code: 'service_unavailable', requestId }, error);
    return Response.json({ error: 'unavailable', message: 'The email could not be filed.', requestId }, { status: 503 });
  }
  if (!result.ok) return Response.json({ error: result.error, message: 'The email could not be filed.' }, { status: 400 });
  return Response.json({ conversationId: result.conversation.id }, { status: 202 });
}
