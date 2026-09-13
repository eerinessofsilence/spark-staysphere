'use server';

import { contentService } from '@/lib/application/container';
import { formStateFromResult, type ContentFormState } from '../_lib/form-state';
import { revalidateContent } from '../_lib/revalidate';

/**
 * Reconstructs the areas/hotspots array from fields named by domain id
 * (`area-<id>-name`, `hotspot-<id>-label`, …) rather than array indices —
 * the set of areas and hotspots is fixed (the CMS never adds or removes
 * one), so there is nothing to reorder and no need for a hidden JSON input
 * the way the amenities/media lists need.
 */
export async function updateHotelAction(
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const { hotel } = await contentService.getHotelContent();

  const input = {
    name: String(formData.get('name') ?? ''),
    tagline: String(formData.get('tagline') ?? ''),
    location: String(formData.get('location') ?? ''),
    areas: hotel.areas.map((area) => ({
      id: area.id,
      name: String(formData.get(`area-${area.id}-name`) ?? ''),
      description: String(formData.get(`area-${area.id}-description`) ?? ''),
      photoAlt: String(formData.get(`area-${area.id}-photoAlt`) ?? ''),
      hotspots: area.hotspots.map((hotspot) => ({
        id: hotspot.id,
        label: String(formData.get(`hotspot-${hotspot.id}-label`) ?? ''),
        description: String(formData.get(`hotspot-${hotspot.id}-description`) ?? ''),
        cta: String(formData.get(`hotspot-${hotspot.id}-cta`) ?? ''),
      })),
    })),
  };

  const expectedVersion = Number(formData.get('version'));
  const result = await contentService.updateHotel(input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Hotel details saved.');
}
