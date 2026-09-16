'use server';

import { z } from 'zod';
import type { TripSummary } from '@/lib/application/booking-service';
import { bookingService, DEMO_HOTEL_SLUG, sampleBookingService } from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';
import { BOOKING_REFERENCE_PATTERN } from '@/lib/domain/booking';

/**
 * "My trips" reads bookings the browser remembers, and claims ones it does
 * not. Both go through the service rather than the repository, so the rule
 * about what a reference alone may reveal is decided in one place.
 */

const referenceSchema = z
  .string()
  .trim()
  .regex(BOOKING_REFERENCE_PATTERN, 'A booking number looks like 3F7K2P.');

const claimSchema = z.object({
  reference: referenceSchema,
  email: z.string().email('Enter the email address the booking was made with.'),
});

export async function loadTrips(references: string[]): Promise<TripSummary[]> {
  const valid = references.filter((reference) => referenceSchema.safeParse(reference).success);
  if (valid.length === 0) return [];
  return bookingService.listTrips(valid);
}

/**
 * What a browser with no trips of its own sees instead of a blank page: two
 * standing demo stays, created once and reused from then on (see
 * `SampleBookingService.seedShowcase`). Not tied to this browser — every
 * first-time visitor sees the same two — so this only runs when `readTrips()`
 * came back empty, never overriding a browser's own list.
 */
export async function getDefaultTrips(): Promise<TripSummary[]> {
  const bookings = await sampleBookingService.seedShowcase(DEMO_HOTEL_SLUG, toIsoDate(new Date()));
  if (bookings.length === 0) return [];
  return bookingService.listTrips(bookings.map((booking) => booking.reference));
}

/** Stable codes the client maps to a localized message; `message` is the English fallback. */
export type TripActionErrorCode =
  | 'invalid_reference'
  | 'invalid_email'
  | 'not_found'
  | 'stay_started'
  | 'cancel_not_found';

export type ClaimTripResult =
  | { ok: true; trip: TripSummary }
  | { ok: false; code: TripActionErrorCode; message: string };

function zodErrorResult(error: z.ZodError): { ok: false; code: TripActionErrorCode; message: string } {
  const issue = error.issues[0];
  const code: TripActionErrorCode = issue?.path[0] === 'email' ? 'invalid_email' : 'invalid_reference';
  return { ok: false, code, message: issue?.message ?? 'Check those details.' };
}

export async function claimTrip(input: {
  reference: string;
  email: string;
}): Promise<ClaimTripResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorResult(parsed.error);
  }

  const trip = await bookingService.findTrip(parsed.data.reference, parsed.data.email);
  if (!trip) {
    // One message for "no such reference" and for "not your email": the pair
    // has to match, and saying which half was wrong would be a lookup tool.
    return {
      ok: false,
      code: 'not_found',
      message: 'No booking matches that reference and email. Demo bookings are also lost when the server restarts.',
    };
  }
  return { ok: true, trip };
}

export type CancelTripResult =
  | { ok: true; trip: TripSummary }
  | { ok: false; code: TripActionErrorCode; message: string };

export async function cancelTrip(input: {
  reference: string;
  email: string;
}): Promise<CancelTripResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorResult(parsed.error);
  }

  const { outcome, trip } = await bookingService.cancelTrip(parsed.data.reference, parsed.data.email);
  switch (outcome) {
    case 'cancelled':
    case 'already_cancelled':
      // An already-cancelled stay is the state the guest asked for; saying
      // "that failed" about the thing they wanted would be a lie.
      return { ok: true, trip: trip! };
    case 'stay_started':
      return {
        ok: false,
        code: 'stay_started',
        message: 'This stay has already begun — the front desk handles changes from here.',
      };
    default:
      return {
        ok: false,
        code: 'cancel_not_found',
        message: 'That reference and email do not match a booking we can cancel.',
      };
  }
}
