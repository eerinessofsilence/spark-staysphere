'use client';

import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { Switch } from '@/components/ui/switch';
import { ContentForm } from './content-form';
import { Field, TextInput } from './fields';
import { OrderedStringList } from './ordered-string-list';

export interface RateFormValues {
  name: string;
  nightlyPrice: number;
  otaComparisonPrice?: number;
  breakfastIncluded: boolean;
  includedServices: string[];
  cancellationPolicy: string;
}

const EMPTY: RateFormValues = {
  name: '',
  nightlyPrice: 0,
  breakfastIncluded: true,
  includedServices: [],
  cancellationPolicy: '',
};

interface RateFormProps {
  formAction: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  initialVersion: number;
  initial?: RateFormValues;
  currency: string;
  submitLabel: string;
  extraActions?: React.ReactNode;
  idPrefix: string;
}

/** Shared by "add a rate" and "edit this rate" — the currency is fixed to the hotel's own and shown, not editable (see content-service.ts's currency rule). */
export function RateForm({
  formAction,
  initialVersion,
  initial = EMPTY,
  currency,
  submitLabel,
  extraActions,
  idPrefix,
}: RateFormProps) {
  return (
    <ContentForm action={formAction} initialVersion={initialVersion} submitLabel={submitLabel} extraActions={extraActions}>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-name`} name="name" label="Name">
            <TextInput id={`${idPrefix}-name`} name="name" defaultValue={initial.name} required />
          </Field>
          <Field id={`${idPrefix}-nightlyPrice`} name="nightlyPrice" label={`Nightly price (${currency})`}>
            <TextInput
              id={`${idPrefix}-nightlyPrice`}
              name="nightlyPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={initial.nightlyPrice}
              required
            />
          </Field>
        </div>
        <Field
          id={`${idPrefix}-otaComparisonPrice`}
          name="otaComparisonPrice"
          label={`OTA comparison price (${currency})`}
          hint="Optional. Demo-only figure shown as the direct saving — never a live OTA read."
        >
          <TextInput
            id={`${idPrefix}-otaComparisonPrice`}
            name="otaComparisonPrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial.otaComparisonPrice}
          />
        </Field>
        <label htmlFor={`${idPrefix}-breakfastIncluded`} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Switch
            id={`${idPrefix}-breakfastIncluded`}
            name="breakfastIncluded"
            defaultChecked={initial.breakfastIncluded}
            className="shrink-0"
          />
          Breakfast included
        </label>
        <Field id={`${idPrefix}-cancellationPolicy`} name="cancellationPolicy" label="Cancellation policy">
          <TextInput id={`${idPrefix}-cancellationPolicy`} name="cancellationPolicy" defaultValue={initial.cancellationPolicy} required />
        </Field>
        <div role="group" aria-labelledby={`${idPrefix}-includedServices-heading`}>
          <h4 id={`${idPrefix}-includedServices-heading`} className="text-sm font-medium">
            What the rate includes
          </h4>
          <div className="mt-2">
            <OrderedStringList
              name="includedServices"
              initial={initial.includedServices}
              addPlaceholder="Add what's included"
            />
          </div>
        </div>
      </div>
    </ContentForm>
  );
}
