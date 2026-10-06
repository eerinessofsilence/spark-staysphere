'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, CameraIcon } from '@heroicons/react/24/outline';
import { createScannedAddOnAction, recognizeProductAction } from '@/app/admin/content/add-ons/scan/actions';
import type { MediaAsset } from '@/lib/domain/ports';
import type { ProductGuess } from '@/lib/domain/product-recognition';
import type { AddOn } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lAddOnCategory, lPricingUnit } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';
import { Field, Select, TextArea, TextInput } from './fields';
import { ScanModal } from './scan-modal';

const CATEGORIES: AddOn['category'][] = ['service', 'dining'];
const UNITS: AddOn['pricingUnit'][] = ['per_guest', 'per_stay', 'per_night'];

type Draft = { asset: MediaAsset; guess: ProductGuess | null; currency: string };

/**
 * A product held up to the camera becomes an extra on sale: the photo is
 * saved as its picture, the recognizer fills in name, counter and a price
 * guess, and the desk checks the draft before it is created. Everything the
 * form on `/admin/content/add-ons/new` would ask is here, prefilled.
 */
export function ScanProductButton() {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, startSaving] = React.useTransition();

  async function recognize(file: File) {
    const body = new FormData();
    body.set('file', file);
    const result = await recognizeProductAction(body);
    if (!result.ok) return result;
    return { ok: true as const, draft: { asset: result.asset, guess: result.guess, currency: result.currency } };
  }

  function submitDraft(event: React.FormEvent<HTMLFormElement>, draft: Draft) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    startSaving(async () => {
      const result = await createScannedAddOnAction({
        name,
        description: String(data.get('description') ?? '').trim(),
        category: String(data.get('category') ?? 'service'),
        price: Number(data.get('price') ?? 0),
        pricingUnit: String(data.get('pricingUnit') ?? 'per_stay'),
        photoUrl: draft.asset.url,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(t('scan.added', { name }));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        <CameraIcon className="size-4" aria-hidden="true" />
        {t('scan.button')}
      </button>

      <ScanModal<Draft> open={open} onClose={() => setOpen(false)} title={t('scan.title')} intro={t('scan.intro')} recognize={recognize}>
        {(draft, photoUrl, retake) => {
          const guess = draft.guess;
          const unrecognized = guess !== null && !guess.recognized;
          return (
            <form onSubmit={(event) => submitDraft(event, draft)} className="grid gap-4">
              <div className="flex items-start gap-4">
                <img src={photoUrl} alt="" className="size-24 shrink-0 rounded-2xl object-cover" />
                <p className="text-sm text-muted-foreground">
                  {guess === null ? t('scan.noModel') : unrecognized ? t('scan.notRecognized') : t('scan.check')}
                </p>
              </div>
              <Field id="scan-name" name="name" label={t('addOn.name')}>
                <TextInput id="scan-name" name="name" defaultValue={guess?.recognized ? guess.name : ''} required />
              </Field>
              <Field id="scan-description" name="description" label={t('addOn.description')}>
                <TextArea id="scan-description" name="description" defaultValue={guess?.recognized ? guess.description : ''} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="scan-category" name="category" label={t('addOn.category')}>
                  <Select id="scan-category" name="category" defaultValue={guess?.category ?? 'service'} required>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>{lAddOnCategory(category, locale)}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="scan-price" name="price" label={`${t('addOn.price')} (${draft.currency})`}>
                  <TextInput id="scan-price" name="price" type="number" min={0} step="0.01" defaultValue={guess?.suggestedPrice ?? ''} required />
                </Field>
                <Field id="scan-pricingUnit" name="pricingUnit" label={t('addOn.charged')}>
                  <Select id="scan-pricingUnit" name="pricingUnit" defaultValue={guess?.pricingUnit ?? 'per_stay'} required>
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>{lPricingUnit(unit, locale)}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={saving} onClick={retake} className={pill('secondary')}>
                  {t('scan.retake')}
                </button>
                <button type="submit" disabled={saving} className={pill('primary')}>
                  {saving ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {t('scan.add')}
                </button>
              </div>
            </form>
          );
        }}
      </ScanModal>
    </>
  );
}
