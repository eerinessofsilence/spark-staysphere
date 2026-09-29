'use server';

import { redirect } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import type { MediaItemDraft } from '@/components/admin/content/media-list-editor';
import { getAdminT } from '@/lib/i18n/admin/server';
import { formStateFromError, parseJsonList, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export async function createPhysicalRoomAction(
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const roomTypeId = String(formData.get('roomTypeId') ?? '');
  const result = await contentService.createPhysicalRoom({
    roomTypeId,
    number: String(formData.get('number') ?? ''),
    media: parseJsonList<MediaItemDraft>(formData, 'media'),
  });
  if (!result.ok) return formStateFromError(result.error, await getAdminT());

  revalidateContent();
  redirect(`/admin/content/units#type-${roomTypeId}`);
}
