import { Skeleton } from '@/components/ui/skeleton';

export default function BookLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10"
    >
      <span className="sr-only">Preparing your booking…</span>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-6 h-12 w-96 max-w-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
        <div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-11 w-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-80 rounded-3xl" />
        </div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}
