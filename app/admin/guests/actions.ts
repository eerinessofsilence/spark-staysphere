'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { guestSchema } from '@/lib/domain/schemas';
import { getAdminT } from '@/lib/i18n/admin/server';

/**
 * `/admin/guests` — a guest record made before any booking exists: someone
 * who called ahead, a VIP the hotel wants on file. Behind `permViewBookings`,
 * the same permission that books a walk-in on the front desk — this is the
 * same kind of desk record, just without a stay attached yet.
 */
export interface CreateGuestResult {
  ok: boolean;
  message: string;
  id?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createGuestAction(input: unknown): Promise<CreateGuestResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path.at(-1) ?? 'form');
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { ok: false, message: t('guests.checkFields'), fieldErrors };
  }

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const id = parsed.data.email.trim().toLowerCase();
  const existingBookings = await hotelRepository.listBookings();
  if (existingBookings.some((booking) => booking.hotelId === hotel.id && booking.guest.email.trim().toLowerCase() === id)) {
    return { ok: false, message: t('guests.alreadyExists'), id };
  }
  const existingProfiles = await hotelRepository.listGuestProfiles(hotel.id);
  if (existingProfiles.some((profile) => profile.email.trim().toLowerCase() === id)) {
    return { ok: false, message: t('guests.alreadyExists'), id };
  }

  await hotelRepository.createGuestProfile({
    id: crypto.randomUUID(),
    hotelId: hotel.id,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    createdAt: new Date().toISOString(),
  });

  revalidatePath('/admin/guests');
  revalidatePath('/admin/guests/[id]', 'page');
  return { ok: true, message: t('guests.created', { name: `${parsed.data.firstName} ${parsed.data.lastName}` }), id };
}
