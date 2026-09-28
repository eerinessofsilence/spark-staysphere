import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { RoomStatus } from '@/lib/domain/schemas';
import { lStatusText } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

// The same inks and glyphs as the guest site's `StatusBadge`, so a room type
// reads the same on the desk as on its own page — only the locale comes from
// the back office rather than the guest's picker.
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
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap', styles[status], className)}>
      <Icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
      {lStatusText(status, remaining, locale)}
    </span>
  );
}
