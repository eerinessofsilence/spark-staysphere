'use server';

import { contentService } from '@/lib/application/container';
import type { HotelContentInput } from '@/lib/application/content-service';
import type { HotelFacility } from '@/lib/domain/schemas';
import { formStateFromResult, parseJsonList, type ContentFormState } from '../_lib/form-state';
import { revalidateContent } from '../_lib/revalidate';

const AREA_FIELD = /^areas\.([^.]+)\.(name|description|photoAlt)$/;
const HOTSPOT_FIELD = /^areas\.([^.]+)\.hotspots\.([^.]+)\.(label|description|cta)$/;

/**
 * The areas' fields are named by path (`areas.<area>.name`,
 * `areas.<area>.hotspots.<hotspot>.label`) — the same path a field error
 * comes back under — so the form needs no hidden list of which areas it
 * showed: whatever paths arrive are the areas to patch, and `updateHotel`
 * ignores any id the hotel does not actually have.
 */
function parseAreas(formData: FormData): HotelContentInput['areas'] {
  const areas = new Map<string, HotelContentInput['areas'][number]>();
  const area = (id: string) => {
    let entry = areas.get(id);
    if (!entry) {
      entry = { id, name: '', description: '', photoAlt: '', hotspots: [] };
      areas.set(id, entry);
    }
    return entry;
  };
  for (const [key, value] of formData) {
    if (typeof value !== 'string') continue;
    const field = AREA_FIELD.exec(key);
    if (field) {
      area(field[1]!)[field[2] as 'name' | 'description' | 'photoAlt'] = value;
      continue;
    }
    const hotspotField = HOTSPOT_FIELD.exec(key);
    if (!hotspotField) continue;
    const hotspots = area(hotspotField[1]!).hotspots;
    let hotspot = hotspots.find((candidate) => candidate.id === hotspotField[2]);
    if (!hotspot) {
      hotspot = { id: hotspotField[2]!, label: '', description: '', cta: '' };
      hotspots.push(hotspot);
    }
    hotspot[hotspotField[3] as 'label' | 'description' | 'cta'] = value;
  }
  return [...areas.values()];
}

export async function updateHotelAction(
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const input = {
    name: String(formData.get('name') ?? ''),
    tagline: String(formData.get('tagline') ?? ''),
    location: String(formData.get('location') ?? ''),
    starRating: Number(formData.get('starRating')),
    description: String(formData.get('description') ?? ''),
    aboutPhoto: String(formData.get('aboutPhoto') ?? ''),
    facilities: parseJsonList<HotelFacility>(formData, 'facilities'),
    areas: parseAreas(formData),
  };

  const expectedVersion = Number(formData.get('version'));
  const result = await contentService.updateHotel(input, expectedVersion);
  if (result.ok) revalidateContent();
  return formStateFromResult(result, 'Hotel details saved.');
}
