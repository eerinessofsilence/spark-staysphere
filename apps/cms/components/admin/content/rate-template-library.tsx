'use client';

import * as React from 'react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Currency, RateTemplate } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lMoney } from '@/lib/i18n/format';
import { iconButton, pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { Switch } from '@/components/ui/switch';
import { Field, TextArea, TextInput } from './fields';

type Draft = {
  name: string;
  nightlyPrice: string;
  otaComparisonPrice: string;
  breakfastIncluded: boolean;
  includedServices: string;
  cancellationPolicy: string;
  prepaymentPolicy: string;
};

const emptyDraft: Draft = {
  name: '', nightlyPrice: '', otaComparisonPrice: '', breakfastIncluded: false,
  includedServices: '', cancellationPolicy: '', prepaymentPolicy: '',
};

function toDraft(template: RateTemplate): Draft {
  return {
    name: template.name,
    nightlyPrice: String(template.nightlyPrice),
    otaComparisonPrice: template.otaComparisonPrice === undefined ? '' : String(template.otaComparisonPrice),
    breakfastIncluded: template.breakfastIncluded,
    includedServices: template.includedServices.join('\n'),
    cancellationPolicy: template.cancellationPolicy ?? '',
    prepaymentPolicy: template.prepaymentPolicy ?? '',
  };
}

export function RateTemplateLibrary({ initial, currency }: { initial: RateTemplate[]; currency: Currency }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [templates, setTemplates] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const editing = editingId === null ? null : templates.find((template) => template.id === editingId) ?? null;
  const validPrice = draft.nightlyPrice.trim() !== '' && Number.isFinite(Number(draft.nightlyPrice)) && Number(draft.nightlyPrice) > 0;
  const valid = draft.name.trim().length > 0 && validPrice;

  function startNew() {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  }

  function startEdit(template: RateTemplate) {
    setEditingId(template.id);
    setDraft(toDraft(template));
    setOpen(true);
  }

  function saveDraft() {
    if (!valid) return;
    const template: RateTemplate = {
      id: editingId ?? crypto.randomUUID(),
      name: draft.name.trim(),
      nightlyPrice: Number(draft.nightlyPrice),
      ...(draft.otaComparisonPrice.trim() && Number.isFinite(Number(draft.otaComparisonPrice))
        ? { otaComparisonPrice: Number(draft.otaComparisonPrice) }
        : {}),
      breakfastIncluded: draft.breakfastIncluded,
      includedServices: draft.includedServices.split('\n').map((service) => service.trim()).filter(Boolean),
      ...(draft.cancellationPolicy.trim() ? { cancellationPolicy: draft.cancellationPolicy.trim() } : {}),
      ...(draft.prepaymentPolicy.trim() ? { prepaymentPolicy: draft.prepaymentPolicy.trim() } : {}),
    };
    setTemplates((current) => editingId === null
      ? [...current, template]
      : current.map((item) => item.id === editingId ? template : item));
    setOpen(false);
  }

  return (
    <div className="grid gap-4">
      <input type="hidden" name="rateTemplates" value={JSON.stringify(templates)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">{t('rateTemplate.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('rateTemplate.body')}</p>
        </div>
        <button type="button" onClick={startNew} className={pill('secondary')}>
          <PlusIcon className="size-4" aria-hidden="true" />
          {t('rateTemplate.add')}
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">{t('rateTemplate.empty')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <li key={template.id} className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-border p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{template.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{lMoney(template.nightlyPrice, currency, locale)}</p>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {template.includedServices.length ? template.includedServices.join(' · ') : t('rateTemplate.noServices')}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {template.cancellationPolicy || t('rateTemplate.inheritsHotelPolicy')}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => startEdit(template)} aria-label={t('rateTemplate.edit', { name: template.name })} className={iconButton('light', 'size-10')}>
                  <PencilSquareIcon className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setTemplates((current) => current.filter((item) => item.id !== template.id))} aria-label={t('rateTemplate.remove', { name: template.name })} className={iconButton('light', 'size-10')}>
                  <TrashIcon className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t(editing ? 'rateTemplate.editTitle' : 'rateTemplate.newTitle')} className="sm:max-w-2xl">
        <div className="grid gap-4">
          <Field id="rate-template-name" label={t('rate.name')}>
            <TextInput id="rate-template-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="rate-template-price" label={t('rate.nightlyPrice', { currency })}>
              <TextInput id="rate-template-price" type="number" min={0.01} step="0.01" value={draft.nightlyPrice} onChange={(event) => setDraft((current) => ({ ...current, nightlyPrice: event.target.value }))} required />
            </Field>
            <Field id="rate-template-ota-price" label={t('rate.bookingSitePrice', { currency })} hint={t('rate.bookingSiteHint')}>
              <TextInput id="rate-template-ota-price" type="number" min={0} step="0.01" value={draft.otaComparisonPrice} onChange={(event) => setDraft((current) => ({ ...current, otaComparisonPrice: event.target.value }))} />
            </Field>
          </div>
          <label htmlFor="rate-template-breakfast" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Switch id="rate-template-breakfast" checked={draft.breakfastIncluded} onCheckedChange={(checked) => setDraft((current) => ({ ...current, breakfastIncluded: checked }))} />
            {t('rate.breakfastIncluded')}
          </label>
          <Field id="rate-template-services" label={t('rate.includes')} hint={t('rateTemplate.servicesHint')}>
            <TextArea id="rate-template-services" value={draft.includedServices} onChange={(event) => setDraft((current) => ({ ...current, includedServices: event.target.value }))} />
          </Field>
          <Field id="rate-template-cancellation" label={t('hotel.cancellationPolicy')} hint={t('rateTemplate.inheritCancellationHint')}>
            <TextArea id="rate-template-cancellation" maxLength={500} value={draft.cancellationPolicy} onChange={(event) => setDraft((current) => ({ ...current, cancellationPolicy: event.target.value }))} placeholder={t('rateTemplate.cancellationPlaceholder')} />
          </Field>
          <Field id="rate-template-prepayment" label={t('hotel.prepaymentPolicy')} hint={t('rateTemplate.inheritPrepaymentHint')}>
            <TextArea id="rate-template-prepayment" maxLength={500} value={draft.prepaymentPolicy} onChange={(event) => setDraft((current) => ({ ...current, prepaymentPolicy: event.target.value }))} placeholder={t('rateTemplate.prepaymentPlaceholder')} />
          </Field>
          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={() => setOpen(false)} className={pill('secondary')}>{t('frontDesk.cancel')}</button>
            <button type="button" disabled={!valid} onClick={saveDraft} className={pill('primary')}>{t('rateTemplate.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
