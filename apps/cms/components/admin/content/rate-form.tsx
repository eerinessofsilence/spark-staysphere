'use client';

import * as React from 'react';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import type { RateTemplate } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { Switch } from '@/components/ui/switch';
import { ContentForm } from './content-form';
import { Field, Select, TextArea, TextInput } from './fields';
import { OrderedStringList } from './ordered-string-list';

export interface RateFormValues {
  name: string;
  nightlyPrice: number;
  otaComparisonPrice?: number;
  breakfastIncluded: boolean;
  includedServices: string[];
  cancellationPolicy: string;
  prepaymentPolicy: string;
}

const EMPTY: RateFormValues = {
  name: '',
  nightlyPrice: 0,
  breakfastIncluded: true,
  includedServices: [],
  cancellationPolicy: '',
  prepaymentPolicy: '',
};

interface RateFormProps {
  formAction: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  initialVersion: number;
  initial?: RateFormValues;
  templates?: RateTemplate[];
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
  /** Keep this nested form's action row in view; disable when the page has its own fixed save dock. */
  sticky?: boolean;
}

/** Shared by "add a rate" and "edit this rate" — the currency is fixed to the hotel's own and shown, not editable (see content-service.ts's currency rule). */
export function RateForm({
  formAction,
  initialVersion,
  initial = EMPTY,
  templates = [],
  currency,
  submitLabel,
  extraActions,
  idPrefix,
  versionKey,
  resetOnSuccess = false,
  bare = false,
  sticky = true,
}: RateFormProps) {
  const t = useAdminT();
  const [templateId, setTemplateId] = React.useState('');
  const selectedTemplate = templates.find((template) => template.id === templateId);
  const values: RateFormValues = selectedTemplate ? {
    name: selectedTemplate.name,
    nightlyPrice: selectedTemplate.nightlyPrice,
    otaComparisonPrice: selectedTemplate.otaComparisonPrice,
    breakfastIncluded: selectedTemplate.breakfastIncluded,
    includedServices: selectedTemplate.includedServices,
    cancellationPolicy: selectedTemplate.cancellationPolicy ?? '',
    prepaymentPolicy: selectedTemplate.prepaymentPolicy ?? '',
  } : initial;
  // The Room Rates link sits inside the sentence, so the template is split around it.

  return (
    <ContentForm
      action={formAction}
      initialVersion={initialVersion}
      submitLabel={submitLabel}
      extraActions={extraActions}
      versionKey={versionKey}
      resetOnSuccess={resetOnSuccess}
      bare={bare}
      sticky={sticky}
    >
      <div className="grid gap-4">
        {templates.length > 0 ? (
          <Field id={`${idPrefix}-template`} label={t('rateTemplate.choose')} hint={t('rateTemplate.copyHint')}>
            <Select id={`${idPrefix}-template`} value={templateId} onChange={setTemplateId}>
              <option value="">{t(versionKey ? 'rateTemplate.current' : 'rateTemplate.custom')}</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <div key={templateId || 'custom-rate-fields'} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-name`} name="name" label={t('rate.name')}>
            <TextInput id={`${idPrefix}-name`} name="name" defaultValue={values.name} required />
          </Field>
          <Field
            id={`${idPrefix}-nightlyPrice`}
            name="nightlyPrice"
            label={t('rate.nightlyPrice', { currency })}
            hint="Reference price for the public catalog. No date-based rates or availability."
          >
            <TextInput
              id={`${idPrefix}-nightlyPrice`}
              name="nightlyPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={values.nightlyPrice}
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
            defaultValue={values.otaComparisonPrice}
          />
        </Field>
        <label htmlFor={`${idPrefix}-breakfastIncluded`} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Switch
            id={`${idPrefix}-breakfastIncluded`}
            name="breakfastIncluded"
            defaultChecked={values.breakfastIncluded}
            className="shrink-0"
          />
          {t('rate.breakfastIncluded')}
        </label>
        <Field id={`${idPrefix}-cancellationPolicy`} name="cancellationPolicy" label={t('rate.cancellationPolicy')} hint={t('rateTemplate.inheritCancellationHint')}>
          <TextArea id={`${idPrefix}-cancellationPolicy`} name="cancellationPolicy" defaultValue={values.cancellationPolicy} maxLength={500} placeholder={t('rateTemplate.cancellationPlaceholder')} />
        </Field>
        <Field id={`${idPrefix}-prepaymentPolicy`} name="prepaymentPolicy" label={t('hotel.prepaymentPolicy')} hint={t('rateTemplate.inheritPrepaymentHint')}>
          <TextArea id={`${idPrefix}-prepaymentPolicy`} name="prepaymentPolicy" defaultValue={values.prepaymentPolicy} maxLength={500} placeholder={t('rateTemplate.prepaymentPlaceholder')} />
        </Field>
        <div role="group" aria-labelledby={`${idPrefix}-includedServices-heading`}>
          <h4 id={`${idPrefix}-includedServices-heading`} className="text-sm font-medium">
            {t('rate.includes')}
          </h4>
          <div className="mt-2">
            <OrderedStringList
              name="includedServices"
              initial={values.includedServices}
              addPlaceholder={t('rate.addInclusion')}
              itemNoun={t('rate.inclusionNoun')}
            />
          </div>
        </div>
        </div>
      </div>
    </ContentForm>
  );
}
