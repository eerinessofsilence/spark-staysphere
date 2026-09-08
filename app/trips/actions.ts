'use server';

import { z } from 'zod';
import type { TripSummary } from '@/lib/application/booking-service';
import { bookingService } from '@/lib/application/container';

/**
 * "My trips" reads bookings the browser remembers, and claims ones it does
 * not. Both go through the service rather than the repository, so the rule
 * about what a reference alone may reveal is decided in one place.
 */

const referenceSchema = z
  .string()
  .trim()
  .regex(/^AC-[A-Za-z0-9]{6}$/, 'A reference looks like AC-3F7K2P.');

const claimSchema = z.object({
  reference: referenceSchema,
  email: z.string().email('Enter the email address the booking was made with.'),
});

export async function loadTrips(references: string[]): Promise<TripSummary[]> {
  const valid = references.filter((reference) => referenceSchema.safeParse(reference).success);
  if (valid.length === 0) return [];
  return bookingService.listTrips(valid);
}

export type ClaimTripResult =
  | { ok: true; trip: TripSummary }
  | { ok: false; message: string };

export async function claimTrip(input: {
  reference: string;
  email: string;
}): Promise<ClaimTripResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const trip = await bookingService.findTrip(parsed.data.reference, parsed.data.email);
  if (!trip) {
    // One message for "no such reference" and for "not your email": the pair
    // has to match, and saying which half was wrong would be a lookup tool.
    return {
      ok: false,
      message: 'No booking matches that reference and email. Demo bookings are also lost when the server restarts.',
    };
  }
  return { ok: true, trip };
}

export type CancelTripResult =
  | { ok: true; trip: TripSummary }
  | { ok: false; message: string };

export async function cancelTrip(input: {
  reference: string;
  email: string;
}): Promise<CancelTripResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check those details.' };
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
        message: 'This stay has already begun — the front desk handles changes from here.',
      };
    default:
      return {
        ok: false,
        message: 'That reference and email do not match a booking we can cancel.',
      };
  }
}
