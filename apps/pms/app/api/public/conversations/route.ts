import { z } from 'zod';
import { communicationsService, DEMO_HOTEL_SLUG } from '@/lib/application/container';

const requestSchema = z.object({ reference: z.string().trim().min(1), email: z.string().trim().email() });

/** Read the existing chat for a booking only when its guest email matches. */
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request', message: 'A booking reference and email are required.' }, { status: 400 });
  }
  try {
    const thread = await communicationsService.guestChatFor(DEMO_HOTEL_SLUG, parsed.data.reference, parsed.data.email);
    return Response.json({
      conversation: thread ? { conversationId: thread.conversation.id, messages: thread.messages } : null,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Public conversation lookup failed', error);
    return Response.json({ error: 'unavailable', message: 'The conversation is temporarily unavailable.' }, { status: 503 });
  }
}
