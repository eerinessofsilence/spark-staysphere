'use server';

import { redirect } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import type { MediaItemDraft } from '@/components/admin/content/media-list-editor';
import { formStateFromError, parseJsonList, parseNumber, type ContentFormState } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export async function createRoomAction(
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const input = {
    slug: String(formData.get('slug') ?? ''),
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

  const result = await contentService.createRoom(input);
  if (!result.ok) return formStateFromError(result.error);

  revalidateContent();
  redirect(`/admin/content/rooms/${result.value.id}?created=1`);
}
