'use server';

import { revalidatePath } from 'next/cache';
import { contentServiceFor } from '@/lib/application/container';
import { notifyRateChange } from '@/lib/application/rate-change-notification';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminT } from '@/lib/i18n/admin/server';
import {
  formStateFromResult,
  parseJsonList,
  parseNumber,
  parseOptionalNumber,
  type ContentFormState,
} from '@/app/admin/content/_lib/form-state';
import { revalidateContent } from '@/app/admin/content/_lib/revalidate';

export async function updateBaseRateAction(
  roomTypeId: string,
  rateId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
  const contentService = contentServiceFor(await getSelectedHotelSlug());
  const rate = (await contentService.listRatesContent(roomTypeId)).find((candidate) => candidate.id === rateId);
  if (!rate) return { status: 'error', message: 'This rate no longer exists. Reload the page.' };

  const rawPrice = formData.get('nightlyPrice');
  if (rawPrice === null || rawPrice === '' || !Number.isFinite(Number(rawPrice))) {
    return {
      status: 'error',
      message: 'Fix the highlighted fields and try again.',
      fieldErrors: { nightlyPrice: ['Enter a nightly price.'] },
    };
  }

  const result = await contentService.updateRate(
    rateId,
    {
      name: rate.name,
      nightlyPrice: Number(rawPrice),
      otaComparisonPrice: parseOptionalNumber(formData.get('otaComparisonPrice')),
      breakfastIncluded: rate.breakfastIncluded,
      includedServices: rate.includedServices,
      cancellationPolicy: rate.cancellationPolicy,
    },
    Number(formData.get('version')),
    roomTypeId,
  );

  if (result.ok) {
    await notifyRateChange(roomTypeId, rateId, `Base price: ${rate.nightlyPrice} → ${Number(rawPrice)} ${rate.currency}`);
    revalidateContent();
    revalidatePath('/admin/rates');
    revalidatePath('/admin/front-desk');
  }
  return formStateFromResult(result, t('rates.basePriceSaved'), t);
}

export async function updateDateRateAction(
  roomTypeId: string,
  rateId: string,
  date: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
  const clear = formData.get('clear') === 'true';
  const raw = formData.get('nightlyPrice');
  if (!clear && (typeof raw !== 'string' || raw.trim() === '' || !Number.isFinite(Number(raw)))) {
    return { status: 'error', message: t('form.fixHighlighted'), fieldErrors: { nightlyPrice: [t('rates.datePriceInvalid')] } };
  }
  const result = await contentServiceFor(await getSelectedHotelSlug()).updateRateDate(
    rateId,
    roomTypeId,
    date,
    clear ? null : Number(raw),
    Number(formData.get('version')),
  );
  if (result.ok) {
    await notifyRateChange(roomTypeId, rateId, clear ? `Price reset to base on ${date}` : `Price changed on ${date}: ${Number(raw)}`);
    revalidateContent();
    revalidatePath('/admin/rates');
    revalidatePath('/admin/front-desk');
  }
  return formStateFromResult(result, t(clear ? 'rates.datePriceReset' : 'rates.datePriceSaved', { date }), t);
}

export async function updateDateRateRangeAction(
  roomTypeId: string,
  rateId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
  const raw = formData.get('nightlyPrice');
  if (typeof raw !== 'string' || raw.trim() === '' || !Number.isFinite(Number(raw))) {
    return { status: 'error', message: t('form.fixHighlighted'), fieldErrors: { nightlyPrice: [t('rates.datePriceInvalid')] } };
  }
  const from = String(formData.get('from') ?? '');
  const through = String(formData.get('through') ?? '');
  const result = await contentServiceFor(await getSelectedHotelSlug()).updateRateDateRange(
    rateId, roomTypeId, from, through, Number(raw), Number(formData.get('version')),
  );
  if (result.ok) {
    await notifyRateChange(roomTypeId, rateId, `Price changed ${from} – ${through}: ${Number(raw)}`);
    revalidateContent();
    revalidatePath('/admin/rates');
    revalidatePath('/admin/front-desk');
  }
  return formStateFromResult(result, t('rates.rangeSaved', { from, through }), t);
}

function optionalStayNights(value: FormDataEntryValue | null): number | undefined {
  if (value === null || String(value).trim() === '') return undefined;
  return Number(value);
}

export async function updateRateStayRulesAction(
  roomTypeId: string,
  rateId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
  const result = await contentServiceFor(await getSelectedHotelSlug()).updateRateStayRules(
    rateId,
    roomTypeId,
    {
      minimumStay: optionalStayNights(formData.get('minimumStay')),
      maximumStay: optionalStayNights(formData.get('maximumStay')),
      minimumStayOnArrival: optionalStayNights(formData.get('minimumStayOnArrival')),
    },
    Number(formData.get('version')),
  );
  if (result.ok) {
    await notifyRateChange(roomTypeId, rateId, 'Stay restrictions changed');
    revalidateContent();
    revalidatePath('/admin/rates');
  }
  return formStateFromResult(result, t('rates.rulesSaved'), t);
}

export async function updateRateCloseoutAction(
  roomTypeId: string,
  rateId: string,
  date: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
  const closed = formData.get('closed') === 'true';
  const result = await contentServiceFor(await getSelectedHotelSlug()).updateRateCloseout(
    rateId,
    roomTypeId,
    date,
    closed,
    Number(formData.get('version')),
  );
  if (result.ok) {
    await notifyRateChange(roomTypeId, rateId, `${closed ? 'Sales closed' : 'Sales reopened'} on ${date}`);
    revalidateContent();
    revalidatePath('/admin/rates');
  }
  return formStateFromResult(result, t(closed ? 'rates.dateClosed' : 'rates.dateOpened', { date }), t);
}

export async function createRoomRateAction(
  roomTypeId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
  const contentService = contentServiceFor(await getSelectedHotelSlug());
  const result = await contentService.createRate(roomTypeId, {
    name: String(formData.get('name') ?? ''),
    nightlyPrice: parseNumber(formData.get('nightlyPrice')),
    otaComparisonPrice: parseOptionalNumber(formData.get('otaComparisonPrice')),
    breakfastIncluded: formData.get('breakfastIncluded') === 'on',
    includedServices: parseJsonList<string>(formData, 'includedServices'),
    cancellationPolicy: String(formData.get('cancellationPolicy') ?? ''),
  });

  if (result.ok) revalidateContent();
  return formStateFromResult(result, t('room.rateAdded'), t);
}
