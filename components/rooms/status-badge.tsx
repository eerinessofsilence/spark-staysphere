import { AlertCircle, Check, X } from 'lucide-react';
import { statusText } from '@/lib/formatting';
import type { RoomStatus } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';

const styles: Record<RoomStatus, string> = {
  available: 'border-success/25 bg-success/10 text-success',
  limited: 'border-warning/25 bg-warning/10 text-warning',
  last_room: 'border-warning/30 bg-warning/15 text-warning',
  sold_out: 'border-danger/25 bg-danger/10 text-danger',
};

const icons: Record<RoomStatus, typeof Check> = {
  available: Check,
  limited: AlertCircle,
  last_room: AlertCircle,
  sold_out: X,
};

interface StatusBadgeProps {
  status: RoomStatus;
  remaining: number;
  className?: string;
}

/** Icon plus wording carry the meaning; colour is reinforcement only. */
export function StatusBadge({ status, remaining, className }: StatusBadgeProps) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        styles[status],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {statusText(status, remaining)}
    </span>
  );
}
