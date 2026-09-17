import { cookies } from 'next/headers';
import { availableHotels, DEMO_HOTEL_SLUG } from './container';

/** Scoped to `/admin` — the guest site never reads this, and always books the default hotel. */
export const SELECTED_HOTEL_COOKIE = 'admin-hotel';

/** The hotel the admin's property switcher currently points at, for whichever request is asking. */
export async function getSelectedHotelSlug(): Promise<string> {
  const store = await cookies();
  const slug = store.get(SELECTED_HOTEL_COOKIE)?.value;
  return slug && availableHotels.some((hotel) => hotel.slug === slug) ? slug : DEMO_HOTEL_SLUG;
}
