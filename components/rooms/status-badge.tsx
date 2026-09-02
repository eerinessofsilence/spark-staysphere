import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react/dist/ssr';
import { statusText } from '@/lib/formatting';
import type { RoomStatus } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';

const styles: Record<RoomStatus, string> = {
  available: 'bg-success/10 text-success',
  limited: 'bg-warning/10 text-warning',
  last_room: 'bg-warning/15 text-warning',
  sold_out: 'bg-danger/10 text-danger',
};

const icons: Record<RoomStatus, typeof CheckCircle> = {
  available: CheckCircle,
  limited: WarningCircle,
  last_room: WarningCircle,
  sold_out: XCircle,
};

interface StatusBadgeProps {
  status: RoomStatus;
  remaining: number;
  /** Over photography the badge sits on a frosted white pill. */
  onPhoto?: boolean;
  className?: string;
}

/** Icon plus wording carry the meaning; colour is reinforcement only. */
export function StatusBadge({ status, remaining, onPhoto, className }: StatusBadgeProps) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
        onPhoto ? 'glass' : styles[status],
        onPhoto && status === 'sold_out' && 'text-danger',
        onPhoto && status !== 'sold_out' && status !== 'available' && 'text-warning',
        onPhoto && status === 'available' && 'text-success',
        className,
      )}
    >
      <Icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
      {statusText(status, remaining)}
    </span>
  );
}
