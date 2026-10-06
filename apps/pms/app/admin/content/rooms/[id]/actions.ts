'use server';

import { contentService } from '@/lib/application/container';
import { notifyRateChange } from '@/lib/application/rate-change-notification';
import { getAdminT } from '@/lib/i18n/admin/server';
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
  const t = await getAdminT();
  const input = {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    areaM2: parseNumber(formData.get('areaM2')),
    floor: parseNumber(formData.get('floor')),
    capacity: parseNumber(formData.get('capacity')),
    bedType: String(formData.get('bedType') ?? ''),
    view: String(formData.get('view') ?? ''),
    amenities: parseJsonList<string>(formData, 'amenities'),
    facilities: parseJsonList<string>(formData, 'facilities'),
    media: parseJsonList<MediaItemDraft>(formData, 'media'),
  };
  const expectedVersion = Number(formData.get('version'));

  const result = await contentService.updateRoom(id, input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, t('room.saved'), t);
}

export async function setRoomHiddenAction(
  id: string,
  hidden: boolean,
  expectedVersion: number,
): Promise<ContentFormState> {
  const t = await getAdminT();
  const result = await contentService.setRoomHidden(id, hidden, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, hidden ? t('room.nowHidden') : t('room.nowOnSite'), t);
}

export async function createRateAction(
  roomTypeId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
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
  return formStateFromResult(result, t('room.rateAdded'), t);
}

export async function updateRateAction(
  id: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const t = await getAdminT();
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
  if (result.ok) {
    revalidateContent();
    const rooms = await contentService.listRoomsContent();
    for (const room of rooms) {
      if ((await contentService.listRatesContent(room.id)).some((rate) => rate.id === id)) {
        await notifyRateChange(room.id, id, `Base price changed to ${input.nightlyPrice}`);
        break;
      }
    }
  }
  return formStateFromResult(result, t('room.rateSaved'), t);
}

export async function deleteRateAction(id: string, expectedVersion: number): Promise<ContentFormState> {
  const t = await getAdminT();
  const result = await contentService.deleteRate(id, expectedVersion);
  if (!result.ok) return formStateFromError(result.error, t);
  revalidateContent();
  return { status: 'success', message: t('room.rateRemoved') };
}

export async function deleteRoomAction(id: string): Promise<ContentFormState> {
  const t = await getAdminT();
  const result = await contentService.deleteRoom(id);
  if (!result.ok) return formStateFromError(result.error, t);
  revalidateContent();
  return { status: 'success', message: t('rooms.removed') };
}
