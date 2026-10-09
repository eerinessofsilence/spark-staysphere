import type { RatePlan } from '@/lib/domain/schemas';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { RatePriceForm } from '@/components/admin/operations/rate-price-form';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { RatePriceRangeRow } from './rate-price-range-row';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { ratePreviewHref } from './rates-shared';

/**
 * One rate plan's row: a base price beside editable date-specific prices.
 */
export function RatePlanRow({
  rate,
  roomName,
  dates,
  columns,
  updateAction,
  updateDateAction,
  updateRangeAction,
  previewRoomSlug,
  guestBaseUrl,
  previewDate,
  locale,
  t,
  today,
}: {
  rate: RatePlan & { version: number };
  roomName: string;
  dates: string[];
  columns: string;
  updateAction: (prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  updateDateAction: (date: string, prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  updateRangeAction: (prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  previewRoomSlug?: string;
  guestBaseUrl?: string;
  previewDate: string;
  locale: AdminLocale;
  t: AdminT;
  today: string;
}) {
  return (
    // `relative`: `RatePriceForm`'s own `sr-only` labels are `position:
    // absolute` — see `RoomQuotaRow`'s identical comment on why an
    // unpositioned ancestor here would otherwise inflate the document's
    // measured scroll width instead of just staying invisible.
    <RatePriceRangeRow
      rate={rate} dates={dates} columns={columns} today={today} updateDateAction={updateDateAction}
      updateRangeAction={updateRangeAction} previewRoomSlug={previewRoomSlug} guestBaseUrl={guestBaseUrl} locale={locale}
      label={<>
        <p className="truncate text-sm font-medium">
          {rate.name}
          {rate.breakfastIncluded ? (
            <span className="ml-1.5 font-normal text-muted-foreground">· {t('frontDesk.breakfastIncluded')}</span>
          ) : null}
        </p>
        <div className="mt-1">
          <RatePriceForm
            action={updateAction}
            version={rate.version}
            idPrefix={`rate-${rate.id}`}
            roomName={roomName}
            currency={rate.currency}
            nightlyPrice={rate.nightlyPrice}
            otaComparisonPrice={rate.otaComparisonPrice}
            previewHref={previewRoomSlug && guestBaseUrl ? ratePreviewHref(previewRoomSlug, previewDate, guestBaseUrl) : undefined}
          />
        </div>
      </>}
    />
  );
}
