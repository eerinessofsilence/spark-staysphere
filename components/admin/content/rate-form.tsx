'use client';

import Link from 'next/link';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { useAdminT } from '@/lib/i18n/admin/context';
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
  /** `rate:<id>` for an existing rate; omitted when adding one. */
  versionKey?: string;
  /** The add-a-rate form clears itself after each rate it adds. */
  resetOnSuccess?: boolean;
  /** An existing rate's price is also on Room Rates — say so, so the two never look like different numbers. */
  showRatesLink?: boolean;
  /** For a rate form already sitting inside a `Modal` — see `ContentForm`'s own `bare`. */
  bare?: boolean;
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
  versionKey,
  resetOnSuccess = false,
  showRatesLink = false,
  bare = false,
}: RateFormProps) {
  const t = useAdminT();
  // The Room Rates link sits inside the sentence, so the template is split around it.
  const [linkBefore, linkAfter] = t('rate.samePriceHint').split('{link}');

  return (
    <ContentForm
      action={formAction}
      initialVersion={initialVersion}
      submitLabel={submitLabel}
      extraActions={extraActions}
      versionKey={versionKey}
      resetOnSuccess={resetOnSuccess}
      bare={bare}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-name`} name="name" label={t('rate.name')}>
            <TextInput id={`${idPrefix}-name`} name="name" defaultValue={initial.name} required />
          </Field>
          <Field
            id={`${idPrefix}-nightlyPrice`}
            name="nightlyPrice"
            label={t('rate.nightlyPrice', { currency })}
            hint={
              showRatesLink ? (
                <>
                  {linkBefore}
                  <Link href="/admin/rates" className="underline underline-offset-2 hover:text-accent-strong">
                    {t('nav.roomRates')}
                  </Link>
                  {linkAfter}
                </>
              ) : undefined
            }
          >
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
          label={t('rate.bookingSitePrice', { currency })}
          hint={t('rate.bookingSiteHint')}
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
          {t('rate.breakfastIncluded')}
        </label>
        <Field id={`${idPrefix}-cancellationPolicy`} name="cancellationPolicy" label={t('rate.cancellationPolicy')}>
          <TextInput id={`${idPrefix}-cancellationPolicy`} name="cancellationPolicy" defaultValue={initial.cancellationPolicy} required />
        </Field>
        <div role="group" aria-labelledby={`${idPrefix}-includedServices-heading`}>
          <h4 id={`${idPrefix}-includedServices-heading`} className="text-sm font-medium">
            {t('rate.includes')}
          </h4>
          <div className="mt-2">
            <OrderedStringList
              name="includedServices"
              initial={initial.includedServices}
              addPlaceholder={t('rate.addInclusion')}
              itemNoun={t('rate.inclusionNoun')}
            />
          </div>
        </div>
      </div>
    </ContentForm>
  );
}
