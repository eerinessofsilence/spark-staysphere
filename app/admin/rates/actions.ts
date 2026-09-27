'use server';

import { revalidatePath } from 'next/cache';
import { contentServiceFor } from '@/lib/application/container';
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
    revalidateContent();
    revalidatePath('/admin/rates');
    revalidatePath('/admin/front-desk');
  }
  return formStateFromResult(result, 'Saved — live on the site.');
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
