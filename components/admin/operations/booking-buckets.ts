import type { StayBucket } from '@/lib/domain/availability';
import type { Booking } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';

// The rule itself lives in lib/domain so the guest trips list (which folds
// `in_house` into its own "upcoming" tab) can share it — see
// components/trips/trips-view.tsx.
export { stayBucket, type StayBucket } from '@/lib/domain/availability';

export const stayBuckets: StayBucket[] = ['upcoming', 'in_house', 'past', 'cancelled'];

/** The bucket's name in the team member's language: `t(stayBucketKey(bucket))`. */
export const stayBucketKey: Record<StayBucket, AdminTranslationKey> = {
  upcoming: 'ops.bucketUpcoming',
  in_house: 'ops.bucketInHouse',
  past: 'ops.bucketPast',
  cancelled: 'ops.bucketCancelled',
};

/**
 * Whether any night of the stay falls on a day from `from` to `to`, both
 * inclusive — so an arrival, a departure and a stay running through all
 * count. The check-out day itself is not a night.
 */
export function staysOverlap(booking: Booking, from: string, to: string): boolean {
  return booking.checkIn <= to && booking.checkOut > from;
}
