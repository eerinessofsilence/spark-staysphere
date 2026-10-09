import { quoteForSlug, quoteRequestBodySchema } from '@/lib/application/booking-intake';
import { parseJsonBody, toBookingErrorResponse } from '../_lib/http';

/** POST /api/quotes — server-authoritative price and availability for a stay. */
export async function POST(request: Request): Promise<Response> {
  const parsed = await parseJsonBody(request, quoteRequestBodySchema, 'The quote request is not valid.');
  if (!parsed.ok) return parsed.response;

  try {
    return Response.json({ quote: await quoteForSlug(parsed.data) });
  } catch (error) {
    return toBookingErrorResponse(error, 'Quote failed', 'Could not price that stay.');
  }
}
