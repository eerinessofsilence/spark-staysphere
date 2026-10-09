'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import { useActionState } from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { idleFormState, type ContentFormState } from '@/app/admin/content/_lib/form-state';
import { toast } from '@/components/admin/shell/toast';
import { ratePreviewHref } from '@/components/admin/rates/rates-shared';
import { useAdminT } from '@/lib/i18n/admin/context';
import { Modal } from '@/components/site/modal';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

type UpdateDateRateAction = (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;

export function RateDateCell({
  action,
  rateId,
  date,
  dateLabel,
  rateName,
  currency,
  basePrice,
  overridePrice,
  version,
  previewRoomSlug,
  guestBaseUrl,
  selectedForRange = false,
  isToday = false,
}: {
  action: UpdateDateRateAction;
  rateId: string;
  date: string;
  dateLabel: string;
  rateName: string;
  currency: string;
  basePrice: number;
  overridePrice?: number;
  version: number;
  previewRoomSlug?: string;
  guestBaseUrl?: string;
  selectedForRange?: boolean;
  isToday?: boolean;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(action, idleFormState);
  const [editing, setEditing] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [draft, setDraft] = React.useState(String(overridePrice ?? basePrice));
  const [currentVersion, setCurrentVersion] = React.useState(version);
  const [currentOverride, setCurrentOverride] = React.useState(overridePrice);
  const lastChange = React.useRef<'save' | 'clear'>('save');
  const submittedPrice = React.useRef<number>(overridePrice ?? basePrice);
  const handledState = React.useRef<ContentFormState>(idleFormState);

  React.useEffect(() => setReady(true), []);

  React.useEffect(() => {
    setCurrentVersion(version);
    setCurrentOverride(overridePrice);
  }, [version, overridePrice]);

  React.useEffect(() => {
    if (state === handledState.current) return;
    handledState.current = state;
    if (state.status === 'success') {
      if (state.version !== undefined) setCurrentVersion(state.version);
      setCurrentOverride(lastChange.current === 'clear' ? undefined : submittedPrice.current);
      setEditing(false);
      if (previewRoomSlug && guestBaseUrl) toast.preview(state.message, ratePreviewHref(previewRoomSlug, date, guestBaseUrl), t('rates.previewOnSite'));
      else toast.success(`${state.message} ${t('rates.previewUnavailable')}`);
      router.refresh();
    } else if (state.conflict && state.version !== undefined) {
      setCurrentVersion(state.version);
    }
  }, [state, router, previewRoomSlug, guestBaseUrl, date, t]);

  const price = currentOverride ?? basePrice;
  const fieldId = `date-rate-${date}-${rateId}`;
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    lastChange.current = 'save';
    submittedPrice.current = Number(draft);
    React.startTransition(() => dispatch(new FormData(event.currentTarget)));
  };
  const clear = () => {
    lastChange.current = 'clear';
    const data = new FormData();
    data.set('version', String(currentVersion));
    data.set('clear', 'true');
    React.startTransition(() => dispatch(data));
  };
  const close = () => {
    if (pending) return;
    setDraft(String(price));
    setEditing(false);
  };

  return (
    <>
    <div data-rate-price data-date={date} data-rate-today={isToday ? 'true' : undefined} data-range-selected={selectedForRange ? 'true' : undefined} className={cn('relative flex min-w-0 flex-col items-center justify-center border-l border-border px-1 py-1.5 text-center tabular-nums', isToday && 'bg-accent/10', selectedForRange && 'bg-accent-soft')}>
        <button
          type="button"
          disabled={!ready}
          onClick={() => { setDraft(String(price)); setEditing(true); }}
          aria-label={t('rates.editDatePrice', { rate: rateName, date: dateLabel, price: String(price), currency })}
          className="flex min-h-11 w-full items-center justify-center gap-0.5 rounded-full text-sm hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span aria-hidden="true" className={currentOverride !== undefined ? 'font-semibold text-accent-strong' : 'text-muted-foreground'}>{price}</span>
          {currentOverride !== undefined ? <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /> : null}
        </button>
    </div>
    <Modal open={editing} onClose={close} title={t('rates.datePriceLabel', { rate: rateName, date: dateLabel, currency })}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium">{t('rates.rangeNewPrice')}</label>
          <div className="mt-2 flex overflow-hidden rounded-2xl border border-border bg-card focus-within:ring-2 focus-within:ring-accent">
            <input type="hidden" name="version" value={currentVersion} />
            <input id={fieldId} name="nightlyPrice" type="number" inputMode="decimal" min="0.01" step="0.01"
              value={draft} onChange={(event) => setDraft(event.target.value)} disabled={pending}
              aria-invalid={state.status === 'error' ? true : undefined}
              className="min-h-12 min-w-0 flex-1 px-4 text-foreground outline-none" />
            <span className="flex min-w-14 items-center justify-center border-l border-border text-sm text-muted-foreground">{currency}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('rates.useBasePrice')}: {basePrice} {currency}</p>
          {state.status === 'error' ? <p role="alert" className="mt-2 text-sm text-danger">{state.fieldErrors?.nightlyPrice?.[0] ?? state.message}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {currentOverride !== undefined ? <button type="button" onClick={clear} disabled={pending} className={pill('ghost')}>{t('rates.useBasePrice')}</button> : null}
          <button type="button" onClick={close} disabled={pending} className={pill('secondary')}>{t('rates.cancelDateEdit')}</button>
          <button type="submit" disabled={pending} className={pill('primary')}>{t('ops.save')}</button>
        </div>
        <Preloader active={pending} label={t('form.saving')} className="mt-3" />
      </form>
    </Modal>
    </>
  );
}
