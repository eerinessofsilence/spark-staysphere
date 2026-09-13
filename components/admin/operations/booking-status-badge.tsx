import { CheckCircle, Clock, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { Booking } from '@/lib/domain/schemas';
import { bookingStatusLabels } from '@/lib/formatting';
import { cn } from '@/lib/utils';

const styles: Record<Booking['status'], string> = {
  confirmed: 'bg-success/10 text-success',
  held: 'bg-warning/10 text-warning',
  draft: 'bg-warning/10 text-warning',
  cancelled: 'bg-stone text-muted-foreground',
};

const icons: Record<Booking['status'], typeof CheckCircle> = {
  confirmed: CheckCircle,
  held: Clock,
  draft: Clock,
  cancelled: XCircle,
};

export function BookingStatusBadge({ status, className }: { status: Booking['status']; className?: string }) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
        styles[status],
        className,
      )}
    >
      <Icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
      {bookingStatusLabels[status]}
    </span>
  );
}
