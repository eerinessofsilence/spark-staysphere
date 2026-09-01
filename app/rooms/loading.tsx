import { Skeleton } from '@/components/ui/skeleton';

export default function RoomsLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10"
    >
      <span className="sr-only">Loading rooms…</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-12 w-72" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-20 w-full rounded-3xl" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] lg:gap-8">
        <Skeleton className="hidden h-[32rem] rounded-3xl lg:block" />
        <div className="grid gap-6">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-72 rounded-3xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
