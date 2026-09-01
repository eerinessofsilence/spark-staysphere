import { BookingError } from '@/lib/application/booking-service';
import { quoteForSlug, quoteRequestBodySchema } from '@/lib/application/booking-intake';
import { HotelNotFoundError, RoomNotFoundError } from '@/lib/application/catalog-service';

/** POST /api/quotes — server-authoritative price and availability for a stay. */
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = quoteRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_request', message: 'The quote request is not valid.' },
      { status: 400 },
    );
  }

  try {
    return Response.json({ quote: await quoteForSlug(parsed.data) });
  } catch (error) {
    if (error instanceof RoomNotFoundError || error instanceof HotelNotFoundError) {
      return Response.json({ error: 'not_found', message: error.message }, { status: 404 });
    }
    if (error instanceof BookingError) {
      return Response.json({ error: error.code, message: error.message }, { status: 400 });
    }
    console.error('Quote failed', error);
    return Response.json({ error: 'internal', message: 'Could not price that stay.' }, { status: 500 });
  }
}
