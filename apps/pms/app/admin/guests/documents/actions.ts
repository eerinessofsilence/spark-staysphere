'use server';

import { requirePermission } from '@/lib/application/admin-session';
import { catalogService, guestDocumentService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { GuestIdentity } from '@/lib/domain/guest-document';
import { MAX_DOCUMENT_BYTES } from '@/lib/domain/guest-document';
import type { Guest } from '@/lib/domain/schemas';
import { revalidatePath } from 'next/cache';

export async function searchBookingGuestsAction(query: string) {
  await requirePermission('team.permViewBookings');
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  return guestDocumentService.searchGuests(hotel.id, query.slice(0, 100));
}

export async function changeDocumentAction(id: string, identity: GuestIdentity | null, upload?: FormData) {
  try {
    await requirePermission('team.permViewBookings');
    const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
    const photo = upload?.get('photo');
    if (photo && identity) {
      if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_DOCUMENT_BYTES) return { ok: false as const };
      await guestDocumentService.replacePhoto(hotel.id, id, identity, await photo.arrayBuffer());
    } else if (identity) await guestDocumentService.updateIdentity(hotel.id, id, identity);
    else await guestDocumentService.removePhoto(hotel.id, id);
    revalidatePath('/admin/documents');
    revalidatePath('/admin/guests/[id]', 'page');
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

export async function confirmScannedGuestAction(guest: Guest, identity: GuestIdentity, existingGuestId?: string, distinctGuest = false) {
  try {
    await requirePermission('team.permViewBookings');
    const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
    const result = await guestDocumentService.reviewGuest(hotel.id, guest, identity, existingGuestId, distinctGuest);
    revalidatePath('/admin/guests');
    revalidatePath('/admin/guests/[id]', 'page');
    return { ok: true as const, ...result };
  } catch { return { ok: false as const, message: 'Unable to confirm the guest. Check the fields and your access, then try again.' }; }
}
