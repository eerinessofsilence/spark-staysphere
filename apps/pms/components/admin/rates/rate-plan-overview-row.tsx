import Link from 'next/link';
import type { RatePlan } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { RatePriceRangeRow } from './rate-price-range-row';

/** Edit each dated price directly in the overview grid. */
export function RatePlanOverviewRow({
  rate,
  dates,
  columns,
  href,
  updateDateAction,
  updateRangeAction,
  previewRoomSlug,
  guestBaseUrl,
  locale,
  today,
}: {
  rate: RatePlan & { version: number };
  dates: string[];
  columns: string;
  href: string;
  updateDateAction: (date: string, prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  updateRangeAction: (prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  previewRoomSlug?: string;
  guestBaseUrl?: string;
  locale: AdminLocale;
  today: string;
}) {
  return (
    <RatePriceRangeRow
      rate={rate} dates={dates} columns={columns} today={today} updateDateAction={updateDateAction}
      updateRangeAction={updateRangeAction} previewRoomSlug={previewRoomSlug} guestBaseUrl={guestBaseUrl} locale={locale}
      label={
        <Link href={href} className="block truncate font-medium hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {rate.name}
        </Link>
      }
    />
  );
}
