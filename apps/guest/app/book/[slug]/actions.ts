'use server';

import type { BookingErrorCode } from '@/lib/application/guest-contracts';
import { bookingRequestBodySchema, quoteRequestBodySchema } from '@/lib/application/booking-contract';
import type { PaymentMethod, Quote } from '@/lib/domain/schemas';
import { createPublicBooking, getPublicQuote, PmsApiError } from '@/lib/application/pms-api';

/**
 * The booking UI's only entry point to quotes and confirmation. Both actions go
 * through PMS's server-authoritative quote and booking endpoints; a tampered
 * payload cannot set its own total or bypass the PMS idempotency check.
 */

export interface ConfirmBookingInput {
  roomSlug: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addOnIds: string[];
  guest: { firstName: string; lastName: string; email: string; phone: string };
  /** Total the guest saw on the review step. */
  expectedTotal: number;
  paymentMethod: PaymentMethod;
  /** A room picked on the floor plan; omitted, any room of the type is booked. */
  unitNumber?: string;
  /** Generated once per booking attempt in the browser; replays are no-ops. */
  idempotencyKey: string;
}

export type ConfirmBookingResult =
  | { ok: true; reference: string }
  | {
      ok: false;
      code: BookingErrorCode;
      message: string;
      currentTotal?: number;
      fieldErrors?: Record<string, string[]>;
    };

export async function quoteStay(input: {
  roomSlug: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addOnIds: string[];
}): Promise<{ ok: true; quote: Quote } | { ok: false; message: string }> {
  const parsed = quoteRequestBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Those dates are not a valid stay.' };

  try {
    return { ok: true, quote: await getPublicQuote(parsed.data) };
  } catch (error) {
    if (error instanceof PmsApiError) return { ok: false, message: error.message };
    return { ok: false, message: 'We could not price that stay. Choose another room or dates.' };
  }
}

export async function confirmBooking(input: ConfirmBookingInput): Promise<ConfirmBookingResult> {
  if (input.idempotencyKey.length < 8) {
    return { ok: false, code: 'invalid_request', message: 'This booking attempt is not valid.' };
  }

  const parsed = bookingRequestBodySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      // Guest issues arrive as ['guest', 'email']; the form keys off the leaf.
      const key = String(issue.path.at(-1) ?? 'form');
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return {
      ok: false,
      code: 'invalid_request',
      message: 'Check the highlighted details and try again.',
      fieldErrors,
    };
  }

  try {
    const booking = await createPublicBooking(parsed.data, input.idempotencyKey);
    return { ok: true, reference: booking.reference };
  } catch (error) {
    const bookingCodes: BookingErrorCode[] = [
      'invalid_request', 'unavailable', 'price_changed', 'payment_declined', 'not_found',
    ];
    if (error instanceof PmsApiError && error.code && bookingCodes.includes(error.code as BookingErrorCode)) {
      const code = error.code as BookingErrorCode;
      return {
        ok: false,
        code,
        message: error.message,
        currentTotal: error.currentTotal,
        fieldErrors: error.fieldErrors,
      };
    }
    console.error('Booking confirmation failed', error);
    return {
      ok: false,
      code: 'invalid_request',
      message: 'Something went wrong confirming this demo booking. Nothing was charged.',
    };
  }
}
