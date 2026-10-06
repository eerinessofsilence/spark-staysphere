'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RatePlan } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { useAdminT } from '@/lib/i18n/admin/context';
import { lDateShort } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { idleFormState, type ContentFormState } from '@/app/admin/content/_lib/form-state';
import { ratePreviewHref } from './rates-shared';
import { RateDateCell } from './rate-date-cell';

type DateAction = (date: string, state: ContentFormState, data: FormData) => Promise<ContentFormState>;
type RangeAction = (state: ContentFormState, data: FormData) => Promise<ContentFormState>;
type Selection = { start: number; end: number };

/** Drag across one plan's dated cells, or use the explicit two-tap selection control. */
export function RatePriceRangeRow({ rate, dates, columns, label, updateDateAction, updateRangeAction, previewRoomSlug, guestBaseUrl, locale, today }: {
  rate: RatePlan & { version: number };
  dates: string[];
  columns: string;
  label: React.ReactNode;
  updateDateAction: DateAction;
  updateRangeAction: RangeAction;
  previewRoomSlug?: string;
  guestBaseUrl?: string;
  locale: AdminLocale;
  today: string;
}) {
  const t = useAdminT();
  const router = useRouter();
  const rowRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<{ pointerId: number; start: number; last: number; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClickRef = React.useRef(false);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [modalRange, setModalRange] = React.useState<Selection | null>(null);
  const [selectMode, setSelectMode] = React.useState(false);
  const [anchor, setAnchor] = React.useState<number | null>(null);
  const [draftPrice, setDraftPrice] = React.useState('');
  const [error, setError] = React.useState('');
  const [conflict, setConflict] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [version, setVersion] = React.useState(rate.version);

  React.useEffect(() => setVersion(rate.version), [rate.version]);

  const indexAt = React.useCallback((target: EventTarget | null): number => {
    if (!(target instanceof Element) || !rowRef.current) return -1;
    const cell = target.closest('[data-rate-price]');
    if (!cell || !rowRef.current.contains(cell)) return -1;
    return dates.indexOf(cell.getAttribute('data-date') ?? '');
  }, [dates]);

  const openRange = React.useCallback((first: number, last: number) => {
    const start = Math.min(first, last);
    const end = Math.max(first, last);
    if (start === end) return;
    setSelection({ start, end });
    setModalRange({ start, end });
    setDraftPrice(String(rate.nightlyPriceOverrides?.[dates[start]!] ?? rate.nightlyPrice));
    setError('');
    setConflict(false);
    setSelectMode(false);
    setAnchor(null);
  }, [dates, rate.nightlyPrice, rate.nightlyPriceOverrides]);

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const active = activeRef.current;
      if (!active || event.pointerId !== active.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const index = indexAt(target);
      if (index < 0) return;
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 6 && !active.dragging) return;
      if (index === active.start && !active.dragging) return;
      active.dragging = true;
      active.last = index;
      setSelection({ start: Math.min(active.start, index), end: Math.max(active.start, index) });
      event.preventDefault();
    };
    const onUp = (event: PointerEvent) => {
      const active = activeRef.current;
      if (!active || event.pointerId !== active.pointerId) return;
      activeRef.current = null;
      if (active.dragging && active.last !== active.start) {
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        openRange(active.start, active.last);
      } else setSelection(null);
    };
    const onCancel = (event: PointerEvent) => {
      if (activeRef.current?.pointerId !== event.pointerId) return;
      activeRef.current = null;
      setSelection(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [indexAt, openRange]);

  const close = () => {
    if (pending) return;
    setModalRange(null);
    setSelection(null);
    setError('');
    setConflict(false);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalRange || pending || conflict) return;
    setPending(true);
    setError('');
    const data = new FormData();
    data.set('from', dates[modalRange.start]!);
    data.set('through', dates[modalRange.end]!);
    data.set('nightlyPrice', draftPrice);
    data.set('version', String(version));
    try {
      const result = await updateRangeAction(idleFormState, data);
      if (result.status === 'success') {
        if (result.version !== undefined) setVersion(result.version);
        if (previewRoomSlug && guestBaseUrl) toast.preview(result.message, ratePreviewHref(previewRoomSlug, dates[modalRange.start]!, guestBaseUrl), t('rates.previewOnSite'));
        else toast.success(`${result.message} ${t('rates.previewUnavailable')}`);
        setModalRange(null);
        setSelection(null);
        router.refresh();
      } else {
        if (result.conflict) setConflict(true);
        setError(result.fieldErrors?.nightlyPrice?.[0] ?? result.message);
      }
    } catch {
      setError(t('rates.rangeUnavailable'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      ref={rowRef}
      data-rate-plan={rate.id}
      className="relative grid items-center border-b border-border last:border-b-0"
      style={{ gridTemplateColumns: columns, userSelect: selection ? 'none' : undefined }}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.pointerType === 'touch' || selectMode || modalRange) return;
        if ((event.target as Element).closest('form')) return;
        const index = indexAt(event.target);
        if (index < 0) return;
        activeRef.current = { pointerId: event.pointerId, start: index, last: index, x: event.clientX, y: event.clientY, dragging: false };
      }}
      onClickCapture={(event) => {
        if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); return; }
        const index = indexAt(event.target);
        if (index < 0 || (!selectMode && !event.shiftKey)) return;
        event.preventDefault();
        event.stopPropagation();
        if (anchor === null) { setAnchor(index); setSelection({ start: index, end: index }); }
        else openRange(anchor, index);
      }}
    >
      <div className="sticky left-0 z-20 min-w-0 bg-card px-4 py-2.5">
        {label}
        <button
          type="button"
          aria-pressed={selectMode}
          onClick={() => { setSelectMode((value) => !value); setAnchor(null); setSelection(null); }}
          className="mt-1 min-h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-stone hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {selectMode ? t('rates.rangePickDates') : t('rates.rangeSelect')}
        </button>
      </div>
      {dates.map((date, index) => (
        <RateDateCell
          key={date}
          action={updateDateAction.bind(null, date)}
          rateId={rate.id}
          date={date}
          dateLabel={lDateShort(date, locale)}
          rateName={rate.name}
          currency={rate.currency}
          basePrice={rate.nightlyPrice}
          overridePrice={rate.nightlyPriceOverrides?.[date]}
          version={rate.version}
          previewRoomSlug={previewRoomSlug}
          guestBaseUrl={guestBaseUrl}
          selectedForRange={selection !== null && index >= selection.start && index <= selection.end}
          isToday={date === today}
        />
      ))}
      <Modal open={modalRange !== null} onClose={close} title={t('rates.rangeTitle')}>
        {modalRange ? (
          <form onSubmit={save} className="space-y-5">
            <div role="group" aria-label={t('rates.rangePeriod')}>
              <p className="text-sm font-medium">{t('rates.rangePeriod')}</p>
              <p className="mt-2 rounded-2xl border border-border bg-stone px-4 py-3 text-sm tabular-nums">
                {lDateShort(dates[modalRange.start]!, locale)} – {lDateShort(dates[modalRange.end]!, locale)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{t('rates.rangeNights', { count: modalRange.end - modalRange.start + 1 })} · {rate.name}</p>
            </div>
            <div role="group" aria-label={t('rates.rangeNewPrice')}>
              <label htmlFor={`range-price-${rate.id}`} className="text-sm font-medium">{t('rates.rangeNewPrice')}</label>
              <div className="mt-2 flex overflow-hidden rounded-2xl border border-border bg-card focus-within:ring-2 focus-within:ring-accent">
                <input
                  id={`range-price-${rate.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={draftPrice}
                  onChange={(event) => setDraftPrice(event.target.value)}
                  disabled={pending}
                  className="min-h-12 min-w-0 flex-1 px-4 text-foreground outline-none"
                />
                <span className="flex min-w-14 items-center justify-center border-l border-border text-sm text-muted-foreground">{rate.currency}</span>
              </div>
            </div>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} disabled={pending} className={pill('secondary', 'min-h-11 px-5')}>{t('rates.cancelDateEdit')}</button>
              {conflict ? (
                <button type="button" onClick={() => { close(); router.refresh(); }} className={pill('primary', 'min-h-11 px-6')}>{t('rates.rangeReload')}</button>
              ) : (
                <button type="submit" disabled={pending} className={pill('primary', 'min-h-11 px-6')}>{pending ? t('rates.rangeSaving') : t('ops.save')}</button>
              )}
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
