'use server';

import { contentService } from '@/lib/application/container';
import type { MediaItemDraft } from '@/components/admin/content/media-list-editor';
import {
  formStateFromError,
  formStateFromResult,
  parseJsonList,
  parseNumber,
  parseOptionalNumber,
  type ContentFormState,
} from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export async function updateRoomAction(
  id: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const input = {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    areaM2: parseNumber(formData.get('areaM2')),
    floor: parseNumber(formData.get('floor')),
    capacity: parseNumber(formData.get('capacity')),
    bedType: String(formData.get('bedType') ?? ''),
    view: String(formData.get('view') ?? ''),
    amenities: parseJsonList<string>(formData, 'amenities'),
    media: parseJsonList<MediaItemDraft>(formData, 'media'),
  };
  const expectedVersion = Number(formData.get('version'));

  const result = await contentService.updateRoom(id, input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Room saved.');
}

export async function setRoomHiddenAction(
  id: string,
  hidden: boolean,
  expectedVersion: number,
): Promise<ContentFormState> {
  const result = await contentService.setRoomHidden(id, hidden, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, hidden ? 'Room hidden from the site.' : 'Room is now on the site.');
}

export async function createRateAction(
  roomTypeId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const input = {
    name: String(formData.get('name') ?? ''),
    nightlyPrice: parseNumber(formData.get('nightlyPrice')),
    otaComparisonPrice: parseOptionalNumber(formData.get('otaComparisonPrice')),
    breakfastIncluded: formData.get('breakfastIncluded') === 'on',
    includedServices: parseJsonList<string>(formData, 'includedServices'),
    cancellationPolicy: String(formData.get('cancellationPolicy') ?? ''),
  };
  const result = await contentService.createRate(roomTypeId, input);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Rate added.');
}

export async function updateRateAction(
  id: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const input = {
    name: String(formData.get('name') ?? ''),
    nightlyPrice: parseNumber(formData.get('nightlyPrice')),
    otaComparisonPrice: parseOptionalNumber(formData.get('otaComparisonPrice')),
    breakfastIncluded: formData.get('breakfastIncluded') === 'on',
    includedServices: parseJsonList<string>(formData, 'includedServices'),
    cancellationPolicy: String(formData.get('cancellationPolicy') ?? ''),
  };
  const expectedVersion = Number(formData.get('version'));
  const result = await contentService.updateRate(id, input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Rate saved.');
}

export async function deleteRateAction(id: string, expectedVersion: number): Promise<ContentFormState> {
  const result = await contentService.deleteRate(id, expectedVersion);
  if (!result.ok) return formStateFromError(result.error);
  revalidateContent();
  return { status: 'success', message: 'Rate removed.' };
}
