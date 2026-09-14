'use server';

import { contentService } from '@/lib/application/container';
import { formStateFromError, formStateFromResult, parseJsonList, parseNumber, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export async function updateAddOnAction(
  id: string,
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
  const expectedVersion = Number(formData.get('version'));

  const result = await contentService.updateAddOn(id, input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Add-on saved.');
}

export async function deleteAddOnAction(id: string, expectedVersion: number): Promise<ContentFormState> {
  const result = await contentService.deleteAddOn(id, expectedVersion);
  if (!result.ok) return formStateFromError(result.error);
  revalidateContent();
  return { status: 'success', message: 'Add-on removed.' };
}
