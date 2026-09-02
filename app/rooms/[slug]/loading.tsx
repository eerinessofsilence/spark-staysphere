import { Skeleton } from '@/components/ui/skeleton';

export default function RoomDetailLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10"
    >
      <span className="sr-only">Loading this room…</span>
      <Skeleton className="h-4 w-28" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
        <div>
          <Skeleton className="h-12 w-80 max-w-full" />
          <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
          <Skeleton className="mt-8 aspect-[16/10] w-full rounded-[28px]" />
          <div className="mt-4 flex gap-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-14 w-36 rounded-2xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-96 rounded-[28px]" />
      </div>
    </div>
  );
}
