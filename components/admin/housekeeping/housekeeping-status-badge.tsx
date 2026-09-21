'use client';

import { Broom, CheckCircle, Sparkle, Warning, Wrench } from '@phosphor-icons/react/dist/ssr';
import type { HousekeepingStatus } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { housekeepingStatusKey } from '@/lib/i18n/admin/housekeeping';
import { cn } from '@/lib/utils';

// Dirty borrows the warning ink and out of order the danger one; clean and
// inspected are the same green as a checked-in stay, so "done" reads as one
// colour across the desk and this board.
export const housekeepingStatusStyles: Record<HousekeepingStatus, string> = {
  dirty: 'bg-warning/10 text-warning',
  in_progress: 'bg-stone text-foreground',
  clean: 'bg-success/10 text-success',
  inspected: 'bg-stay-in-house/10 text-stay-in-house',
  out_of_order: 'bg-danger/10 text-danger',
};

export const housekeepingStatusIcons: Record<HousekeepingStatus, typeof Broom> = {
  dirty: Warning,
  in_progress: Broom,
  clean: CheckCircle,
  inspected: Sparkle,
  out_of_order: Wrench,
};

export function HousekeepingStatusBadge({ status, className }: { status: HousekeepingStatus; className?: string }) {
  const t = useAdminT();
  const Icon = housekeepingStatusIcons[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
        housekeepingStatusStyles[status],
        className,
      )}
    >
      <Icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
      {t(housekeepingStatusKey(status))}
    </span>
  );
}
