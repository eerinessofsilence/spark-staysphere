'use server';

import { contentService } from '@/lib/application/container';
import { formStateFromError, formStateFromResult, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export async function updatePhysicalRoomAction(
  id: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const result = await contentService.updatePhysicalRoom(
    id,
    { number: String(formData.get('number') ?? '') },
    Number(formData.get('version')),
  );
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Room saved.');
}

export async function deletePhysicalRoomAction(id: string): Promise<ContentFormState> {
  const result = await contentService.deletePhysicalRoom(id);
  if (!result.ok) return formStateFromError(result.error);
  revalidateContent();
  return { status: 'success', message: 'Room removed.' };
}
