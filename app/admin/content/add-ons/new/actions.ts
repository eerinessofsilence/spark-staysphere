'use server';

import { redirect } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import { formStateFromError, parseJsonList, parseNumber, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export async function createAddOnAction(
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const parentId = String(formData.get('parentId') ?? '');
  const photos = parseJsonList<string>(formData, 'photos');

  const input = {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    category: String(formData.get('category') ?? ''),
    parentId: parentId || undefined,
    photos: photos.length > 0 ? photos : undefined,
    price: parseNumber(formData.get('price')),
    pricingUnit: String(formData.get('pricingUnit') ?? ''),
    enabled: formData.get('enabled') === 'on',
  };

  const result = await contentService.createAddOn(input);
  if (!result.ok) return formStateFromError(result.error);

  revalidateContent();
  redirect(`/admin/content/add-ons/${result.value.id}`);
}
