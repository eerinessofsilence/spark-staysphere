'use client';

import { Broom, CheckCircle, Sparkle, Warning, Wrench } from '@phosphor-icons/react/dist/ssr';
import type { HousekeepingStatus } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { housekeepingStatusKey } from '@/lib/i18n/admin/housekeeping';
import { statusBadge } from '@/lib/ui';
import { cn } from '@/lib/utils';

// Housekeeping uses the shared status palette: warm for work needed, teal for
// clean, olive for inspected, and coral for out of order.
export const housekeepingStatusStyles: Record<HousekeepingStatus, string> = {
  dirty: 'text-status-due-out',
  in_progress: 'text-status-new',
  clean: 'text-status-due-in',
  inspected: 'text-status-in-house',
  out_of_order: 'text-status-no-show',
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
      className={statusBadge(className)}
    >
      <Icon weight="fill" className={cn('size-4 shrink-0', housekeepingStatusStyles[status])} aria-hidden="true" />
      {t(housekeepingStatusKey(status))}
    </span>
  );
}
