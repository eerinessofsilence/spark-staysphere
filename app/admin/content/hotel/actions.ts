'use server';

import { contentService } from '@/lib/application/container';
import { formStateFromResult, type ContentFormState } from '../_lib/form-state';
import { revalidateContent } from '../_lib/revalidate';

export async function updateHotelAction(
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const input = {
    name: String(formData.get('name') ?? ''),
    tagline: String(formData.get('tagline') ?? ''),
    location: String(formData.get('location') ?? ''),
    starRating: Number(formData.get('starRating')),
    // Areas/hotspots have no fields on this form — an empty list leaves
    // every area exactly as it is (see `updateHotel`'s per-area patch match).
    areas: [],
  };

  const expectedVersion = Number(formData.get('version'));
  const result = await contentService.updateHotel(input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Hotel details saved.');
}
