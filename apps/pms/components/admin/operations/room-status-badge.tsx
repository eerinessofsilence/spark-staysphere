import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { RoomStatus } from '@/lib/domain/schemas';
import { lStatusText } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';
import { statusBadge } from '@/lib/ui';

// The same inks and glyphs as the guest site's `StatusBadge`, so a room type
// reads the same on the desk as on its own page — only the locale comes from
// the back office rather than the guest's picker.
const styles: Record<RoomStatus, string> = {
  available: 'text-status-due-in',
  limited: 'text-status-new',
  last_room: 'text-status-due-out',
  sold_out: 'text-status-no-show',
};

const icons: Record<RoomStatus, typeof CheckCircle> = {
  available: CheckCircle,
  limited: WarningCircle,
  last_room: WarningCircle,
  sold_out: XCircle,
};

/** A room type's sale status as a filled mark and words — never colour alone. */
export function RoomStatusBadge({
  status,
  remaining,
  locale,
  className,
}: {
  status: RoomStatus;
  remaining: number;
  locale: Locale;
  className?: string;
}) {
  const Icon = icons[status];
  return (
    <span className={statusBadge(className)}>
      <Icon weight="fill" className={cn('size-4 shrink-0', styles[status])} aria-hidden="true" />
      {lStatusText(status, remaining, locale)}
    </span>
  );
}
