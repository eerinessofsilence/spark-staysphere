'use server';

import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { catalogService, contentService, hotelRepository, productRecognizer } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { MAX_PHOTO_BYTES } from '@/lib/domain/photo-upload';
import type { MediaAsset } from '@/lib/domain/ports';
import type { ProductGuess } from '@/lib/domain/product-recognition';
import { getAdminT } from '@/lib/i18n/admin/server';
import { formStateFromError } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export type RecognizeProductResult =
  | { ok: true; asset: MediaAsset; guess: ProductGuess | null; currency: string }
  | { ok: false; message: string };

/**
 * One photo in, a draft out: the photo is saved to the media library first
 * (it becomes the extra's own picture), then shown to the recognizer. A
 * `null` guess is not an error — it is the form arriving empty.
 */
export async function recognizeProductAction(formData: FormData): Promise<RecognizeProductResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permEditContent');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: t('upload.invalid') };
  }
  const bytes = await file.arrayBuffer();
  const upload = await contentService.uploadPhoto(file.name, file.type, bytes);
  if (!upload.ok) return { ok: false, message: formStateFromError(upload.error, t).message };

  const hotelSlug = await getSelectedHotelSlug();
  const hotel = await catalogService.getHotel(hotelSlug);
  const addOns = await hotelRepository.listAddOns(hotel.id);
  const guess = await productRecognizer.recognize({
    imageBase64: Buffer.from(bytes).toString('base64'),
    mimeType: file.type,
    hotelName: hotel.name,
    currency: hotel.currency,
    existingNames: addOns.map((addOn) => addOn.name),
  });
  return { ok: true, asset: upload.value, guess, currency: hotel.currency };
}

export type CreateScannedAddOnResult = { ok: true; id: string } | { ok: false; message: string };

/** The confirmed draft becomes an extra on sale, through the same `createAddOn` the form uses. */
export async function createScannedAddOnAction(input: {
  name: string;
  description: string;
  category: string;
  price: number;
  pricingUnit: string;
  photoUrl: string;
}): Promise<CreateScannedAddOnResult> {
  const t = await getAdminT();
  const result = await contentService.createAddOn({
    name: input.name,
    description: input.description,
    category: input.category,
    photos: [input.photoUrl],
    price: input.price,
    pricingUnit: input.pricingUnit,
    enabled: true,
  });
  if (!result.ok) {
    const state = formStateFromError(result.error, t);
    // The draft has no per-field error slots, so the first field's message rides in the toast.
    const first = Object.values(state.fieldErrors ?? {}).flat()[0];
    return { ok: false, message: first ? `${state.message} ${first}` : state.message };
  }
  revalidateContent();
  return { ok: true, id: result.value.id };
}
