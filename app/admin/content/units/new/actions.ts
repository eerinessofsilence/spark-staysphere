'use server';

import { redirect } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import { formStateFromError, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export async function createPhysicalRoomAction(
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const roomTypeId = String(formData.get('roomTypeId') ?? '');
  const result = await contentService.createPhysicalRoom({
    roomTypeId,
    number: String(formData.get('number') ?? ''),
  });
  if (!result.ok) return formStateFromError(result.error);

  revalidateContent();
  redirect(`/admin/content/units#type-${roomTypeId}`);
}
