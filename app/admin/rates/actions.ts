'use server';

import { revalidatePath } from 'next/cache';
import { contentService } from '@/lib/application/container';
import {
  formStateFromResult,
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
  );

  if (result.ok) {
    revalidateContent();
    revalidatePath('/admin/rates');
    revalidatePath('/admin/front-desk');
  }
  return formStateFromResult(result, 'Saved — live on the site.');
}
