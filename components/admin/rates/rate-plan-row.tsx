import type { RatePlan } from '@/lib/domain/schemas';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { RatePriceForm } from '@/components/admin/operations/rate-price-form';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';

/**
 * One rate plan's row: its own price form, and the same flat nightly price
 * repeated across every date column — this project's rates aren't priced
 * per date (that's the production PMS/channel manager's job, per
 * `CLAUDE.md`), so repeating the number is the honest picture rather than
 * implying a per-night price this data has never had.
 */
export function RatePlanRow({
  rate,
  roomName,
  dates,
  columns,
  updateAction,
  t,
}: {
  rate: RatePlan & { version: number };
  roomName: string;
  dates: string[];
  columns: string;
  updateAction: (prevState: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  t: AdminT;
}) {
  return (
    // `relative`: `RatePriceForm`'s own `sr-only` labels are `position:
    // absolute` — see `RoomQuotaRow`'s identical comment on why an
    // unpositioned ancestor here would otherwise inflate the document's
    // measured scroll width instead of just staying invisible.
    <div className="relative grid items-center border-b border-border last:border-b-0" style={{ gridTemplateColumns: columns }}>
      <div className="sticky left-0 z-20 min-w-0 bg-card px-4 py-3">
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
          />
        </div>
      </div>
      {dates.map((date) => (
        <div key={date} className="border-l border-border py-1.5 text-center text-muted-foreground tabular-nums">
          {rate.nightlyPrice}
        </div>
      ))}
    </div>
  );
}
