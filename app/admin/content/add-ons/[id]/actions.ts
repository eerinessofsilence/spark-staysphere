'use server';

import { contentService } from '@/lib/application/container';
import type { SaleToggleResult } from '@/components/admin/content/add-on-sale-toggle';
import { formStateFromError, formStateFromResult, parseJsonList, parseNumber, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

/** Saves the add-on's own fields. Whether it is on sale is not one of them — see `setAddOnOnSaleAction`. */
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
  };
  const expectedVersion = Number(formData.get('version'));

  const result = await contentService.updateAddOn(id, input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Add-on saved.');
}

/** The switch in the add-on page's header: acts at once, like the one in the add-on list. */
export async function setAddOnOnSaleAction(id: string, enabled: boolean): Promise<SaleToggleResult> {
  const result = await contentService.setAddOnEnabled(id, enabled);
  if (!result.ok) return { ok: false, message: formStateFromError(result.error).message };
  revalidateContent();
  return {
    ok: true,
    message: enabled ? 'Back on sale.' : 'Withdrawn from sale.',
    version: result.value.version,
    previousVersion: result.value.previousVersion,
  };
}

export async function deleteAddOnAction(id: string, expectedVersion: number): Promise<ContentFormState> {
  const result = await contentService.deleteAddOn(id, expectedVersion);
  if (!result.ok) return formStateFromError(result.error);
  revalidateContent();
  return { status: 'success', message: 'Add-on removed.' };
}
