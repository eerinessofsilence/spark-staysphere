import type { StayBucket } from '@/lib/domain/availability';

// The rule itself lives in lib/domain so the guest trips list (which folds
// `in_house` into its own "upcoming" tab) can share it — see
// components/trips/trips-view.tsx.
export { stayBucket, type StayBucket } from '@/lib/domain/availability';

export const stayBuckets: StayBucket[] = ['upcoming', 'in_house', 'past', 'cancelled'];

export const stayBucketLabels: Record<StayBucket, string> = {
  upcoming: 'Upcoming',
  in_house: 'In house',
  past: 'Past',
  cancelled: 'Cancelled',
};
