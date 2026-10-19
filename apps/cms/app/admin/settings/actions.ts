'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { contentService } from '@/lib/application/container';
import { requirePermission } from '@/lib/application/admin-session';

export async function saveBookingLink(_state: string, form: FormData): Promise<string> {
  await requirePermission('team.permManageTeam');
  const raw = String(form.get('bookingUrl') ?? '').trim();
  const url = raw ? z.url({ protocol: /^https?$/ }).safeParse(raw) : null;
  if (url && !url.success) return 'Enter a valid HTTP or HTTPS booking URL.';
  const { hotel, version } = await contentService.getHotelContent();
  const result = await contentService.updateHotel({ ...hotel, bookingUrl: raw, logoUrl: hotel.logo?.url ?? '', aboutPhoto: hotel.aboutPhoto.url,
    aboutPhotos: (hotel.aboutPhotos ?? [hotel.aboutPhoto]).map((photo) => photo.url), facilities: hotel.facilities ?? [], areas: [] }, version);
  if (!result.ok) return result.error.kind === 'conflict' ? 'Content changed. Reload and try again.' : 'Could not save the booking URL.';
  revalidatePath('/admin/settings');
  return 'Saved.';
}
