import type { ZodType, z } from 'zod';
import { BookingError, type BookingErrorCode } from '@/lib/application/booking-service';
import { HotelNotFoundError, RoomNotFoundError } from '@/lib/application/catalog-service';

/**
 * Shared JSON-body parsing for the booking-adjacent API routes: read the
 * body (never throwing on malformed JSON), validate it against the route's
 * own Zod schema, and hand back a ready-to-return 400 `Response` on failure
 * so every route reports an invalid body the same way. On success, returns
 * the parsed, typed data.
 */
export async function parseJsonBody<S extends ZodType>(
  request: Request,
  schema: S,
  invalidMessage: string,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json({ error: 'invalid_request', message: invalidMessage }, { status: 400 }),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * The one status table for every `BookingErrorCode` — see
 * `lib/application/booking-service.ts`. A code missing here falls back to
 * 400 (a client-correctable problem), which is also correct for every code
 * currently defined; the fallback exists so a new code doesn't 500 by
 * omission.
 */
const STATUS_BY_BOOKING_ERROR_CODE: Record<BookingErrorCode, number> = {
  invalid_request: 400,
  unavailable: 409,
  price_changed: 409,
  payment_declined: 402,
  not_found: 404,
};

export type MappedBookingError =
  | { kind: 'not_found'; message: string }
  | {
      kind: 'booking';
      code: BookingErrorCode;
      message: string;
      currentTotal?: number;
      fieldErrors?: Record<string, string[]>;
    }
  | { kind: 'unknown' };

/**
 * Turns whatever `quoteForSlug`/`confirmForSlug` threw into one shape, shared
 * by the HTTP routes (which wrap it in a `Response`, see
 * `toBookingErrorResponse`) and `app/book/[slug]/actions.ts`'s
 * `confirmBooking`/`quoteStay` (which return it directly to the booking
 * form) — so a route and a server action can never map the same
 * `price_changed` or missing-room failure to two different outcomes.
 */
export function mapBookingError(error: unknown): MappedBookingError {
  if (error instanceof RoomNotFoundError || error instanceof HotelNotFoundError) {
    return { kind: 'not_found', message: error.message };
  }
  if (error instanceof BookingError) {
    return {
      kind: 'booking',
      code: error.code,
      message: error.message,
      currentTotal: error.details?.currentTotal,
      fieldErrors: error.details?.fieldErrors,
    };
  }
  return { kind: 'unknown' };
}

/**
 * `mapBookingError`, wrapped as the `Response` a route should return. Used
 * by both `/api/quotes` and `/api/bookings` so a `price_changed` or a
 * missing room means the same status code and body shape from either
 * endpoint, instead of each route keeping its own (previously inconsistent
 * — quotes mapped every `BookingError` to 400) mapping.
 */
export function toBookingErrorResponse(error: unknown, logLabel: string, fallbackMessage: string): Response {
  const mapped = mapBookingError(error);
  if (mapped.kind === 'not_found') {
    return Response.json({ error: 'not_found', message: mapped.message }, { status: 404 });
  }
  if (mapped.kind === 'booking') {
    return Response.json(
      {
        error: mapped.code,
        message: mapped.message,
        currentTotal: mapped.currentTotal,
        fieldErrors: mapped.fieldErrors,
      },
      { status: STATUS_BY_BOOKING_ERROR_CODE[mapped.code] ?? 400 },
    );
  }
  console.error(logLabel, error);
  return Response.json({ error: 'internal', message: fallbackMessage }, { status: 500 });
}
