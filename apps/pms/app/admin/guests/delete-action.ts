'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/application/admin-session';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';

export async function deleteGuestProfileAction(profileId: string, expectedHotelId: string) {
  await requirePermission('team.permViewBookings');
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  if (hotel.id !== expectedHotelId) return { ok: false, message: 'The selected property changed. Return to the original property to delete this guest.' };
  const profiles = await hotelRepository.listGuestProfiles(hotel.id);
  const profile = profiles.find((candidate) => candidate.id === profileId || candidate.email.trim().toLowerCase() === profileId.trim().toLowerCase());
  const email = profile?.email ?? profileId;
  const bookingsAnonymized = await hotelRepository.anonymizeGuestBookings(hotel.id, email);
  if (profile) await hotelRepository.deleteGuestProfile(profile.id, hotel.id);
  revalidatePath('/admin/guests');
  return { ok: true, message: bookingsAnonymized ? 'Guest deleted and booking history anonymized.' : 'Guest profile deleted.' };
}
