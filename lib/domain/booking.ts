/**
 * A reference alone never opens a booking — this must also agree, the same
 * way in every place a guest is asked to prove it's their stay:
 * `BookingService.findTrip`/`cancelTrip` and `GET /api/bookings/:reference`.
 * Case- and whitespace-insensitive so a guest typing it back from memory,
 * on a phone keyboard that capitalized the first letter, isn't refused.
 */
export function matchesGuestEmail(guestEmail: string, candidate: string): boolean {
  return guestEmail.trim().toLowerCase() === candidate.trim().toLowerCase();
}

/**
 * The shape of a booking reference, not the exact alphabet — `createReference`
 * in `booking-service.ts` only ever generates from a narrower, ambiguity-free
 * set of letters and digits, but this is what a typed-back reference is
 * checked against, both client-side (`lib/trips-storage.ts`) and in the trip
 * claim form's own validation (`app/trips/actions.ts`).
 */
export const BOOKING_REFERENCE_PATTERN = /^AC-[A-Za-z0-9]{6}$/;
