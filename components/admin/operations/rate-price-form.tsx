'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { idleFormState, type ContentFormState } from '@/app/admin/content/_lib/form-state';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface RatePriceFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  version: number;
  idPrefix: string;
  roomName: string;
  currency: string;
  nightlyPrice: number;
  otaComparisonPrice?: number;
}

/** One row of a table: the column header names both inputs, so their labels are read, not drawn. */
export function RatePriceForm({
  action,
  version,
  idPrefix,
  roomName,
  currency,
  nightlyPrice,
  otaComparisonPrice,
}: RatePriceFormProps) {
  const [state, formAction, pending] = useActionState(action, idleFormState);
  const [currentVersion, setCurrentVersion] = React.useState(version);

  React.useEffect(() => {
    if (state.status === 'success' && state.version !== undefined) setCurrentVersion(state.version);
  }, [state]);

  const priceError = state.fieldErrors?.nightlyPrice?.[0];
  const otaError = state.fieldErrors?.otaComparisonPrice?.[0];
  const formError = state.status === 'error' && !priceError && !otaError ? state.message : null;
  const inputClass = cn(fieldClass, 'w-20 px-3 tabular-nums');

  return (
    <form action={formAction} noValidate className="grid gap-1">
      <input type="hidden" name="version" value={currentVersion} />
      <div className="flex items-center gap-2">
        <label htmlFor={`${idPrefix}-price`} className="sr-only">
          Nightly price ({currency}) for {roomName}
        </label>
        <input
          id={`${idPrefix}-price`}
          name="nightlyPrice"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={nightlyPrice}
          aria-invalid={priceError ? true : undefined}
          aria-describedby={priceError ? `${idPrefix}-price-error` : undefined}
          className={inputClass}
        />
        <label htmlFor={`${idPrefix}-ota`} className="sr-only">
          Booking-site price ({currency}) for {roomName}
        </label>
        <input
          id={`${idPrefix}-ota`}
          name="otaComparisonPrice"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="—"
          defaultValue={otaComparisonPrice}
          aria-invalid={otaError ? true : undefined}
          aria-describedby={otaError ? `${idPrefix}-ota-error` : undefined}
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={pill('secondary', 'px-4')}>
          {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save<span className="sr-only"> rate for {roomName}</span>
        </button>
      </div>
      {priceError ? (
        <p id={`${idPrefix}-price-error`} role="alert" className="text-xs font-medium text-danger">
          {priceError}
        </p>
      ) : null}
      {otaError ? (
        <p id={`${idPrefix}-ota-error`} role="alert" className="text-xs font-medium text-danger">
          {otaError}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {formError}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="text-xs font-medium text-success">
        {state.status === 'success' ? state.message : ''}
      </p>
    </form>
  );
}
