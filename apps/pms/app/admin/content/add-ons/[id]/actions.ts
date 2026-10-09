'use server';

import { contentService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import type { SaleToggleResult } from '@/components/admin/content/add-on-sale-toggle';
import { formStateFromError, formStateFromResult, parseJsonList, parseNumber, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

/** Saves the add-on's own fields. Whether it is on sale is not one of them — see `setAddOnOnSaleAction`. */
export async function updateAddOnAction(
  id: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
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
  return formStateFromResult(result, t('addOn.saved'), t);
}

/** The switch in the add-on page's header: acts at once, like the one in the add-on list. */
export async function setAddOnOnSaleAction(id: string, enabled: boolean): Promise<SaleToggleResult> {
  const t = await getAdminT();
  const result = await contentService.setAddOnEnabled(id, enabled);
  if (!result.ok) return { ok: false, message: formStateFromError(result.error, t).message };
  revalidateContent();
  return {
    ok: true,
    message: enabled ? t('addOn.backOnSale') : t('addOn.withdrawnFromSale'),
    version: result.value.version,
    previousVersion: result.value.previousVersion,
  };
}

export async function deleteAddOnAction(id: string, expectedVersion: number): Promise<ContentFormState> {
  const t = await getAdminT();
  const result = await contentService.deleteAddOn(id, expectedVersion);
  if (!result.ok) return formStateFromError(result.error, t);
  revalidateContent();
  return { status: 'success', message: t('addOn.removed') };
}
