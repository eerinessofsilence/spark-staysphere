import {
  ArrowLeftStartOnRectangleIcon,
  ArrowRightEndOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { formatDateShort } from '@/lib/formatting';
import { cn } from '@/lib/utils';

interface StayDatesSummaryProps {
  checkIn: string;
  checkOut: string;
  className?: string;
}

/**
 * The stay as two days rather than one line joined by an arrow. Arrival and
 * departure are two different dates a guest plans around — a flight, a
 * checkout time — so each gets a column and the mark for the direction it
 * runs in: an arrow into a doorway, and one back out of it.
 *
 * Shared by every summary that states the stay, so the room page and the
 * booking flow cannot drift into showing it two different ways.
 */
export function StayDatesSummary({ checkIn, checkOut, className }: StayDatesSummaryProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      <div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowRightEndOnRectangleIcon className="size-4 shrink-0" aria-hidden="true" />
          Check-in
        </p>
        <p className="text-display mt-0.5 text-lg">{formatDateShort(checkIn)}</p>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowLeftStartOnRectangleIcon className="size-4 shrink-0" aria-hidden="true" />
          Check-out
        </p>
        <p className="text-display mt-0.5 text-lg">{formatDateShort(checkOut)}</p>
      </div>
    </div>
  );
}
