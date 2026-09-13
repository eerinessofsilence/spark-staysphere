import type { Booking } from '@/lib/domain/schemas';

export type StayBucket = 'upcoming' | 'in_house' | 'past' | 'cancelled';

export const stayBuckets: StayBucket[] = ['upcoming', 'in_house', 'past', 'cancelled'];

export const stayBucketLabels: Record<StayBucket, string> = {
  upcoming: 'Upcoming',
  in_house: 'In house',
  past: 'Past',
  cancelled: 'Cancelled',
};

export function stayBucket(booking: Booking, today: string): StayBucket {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.checkOut <= today) return 'past';
  if (booking.checkIn <= today) return 'in_house';
  return 'upcoming';
}
