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
 * The shape of a booking reference. PMS generates references from a narrower,
 * ambiguity-free alphabet; Guest uses this for the trip claim form.
 */
export const BOOKING_REFERENCE_PATTERN = /^[A-Za-z0-9]{6}$/;
