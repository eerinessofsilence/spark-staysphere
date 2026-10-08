import { cookies } from 'next/headers';
import { availableHotels, DEMO_HOTEL_SLUG } from './container';
import { getAdminMember } from './admin-session';

/** Scoped to `/admin` — the guest site never reads this, and always books the default hotel. */
export const SELECTED_HOTEL_COOKIE = 'admin-hotel';

/** The hotel the admin's property switcher currently points at, for whichever request is asking. */
export async function getSelectedHotelSlug(): Promise<string> {
  const store = await cookies();
  const slug = store.get(SELECTED_HOTEL_COOKIE)?.value;
  const member = await getAdminMember();
  if (member?.role === 'Hotelier') {
    const assigned = availableHotels.filter((hotel) => member.hotelIds?.includes(hotel.id));
    return assigned.find((hotel) => hotel.slug === slug)?.slug ?? assigned[0]?.slug ?? '';
  }
  return slug && availableHotels.some((hotel) => hotel.slug === slug) ? slug : DEMO_HOTEL_SLUG;
}
