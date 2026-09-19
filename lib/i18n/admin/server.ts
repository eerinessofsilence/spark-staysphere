import { cookies } from 'next/headers';
import { ADMIN_LOCALE_COOKIE, DEFAULT_ADMIN_LOCALE, isAdminLocale, type AdminLocale } from './locale';
import { adminT, type AdminT } from './translate';

/**
 * The team member's language for whichever request is asking — read from the
 * `/admin` cookie the same way `getSelectedHotelSlug` reads the property, so
 * a server component renders the right words from the first byte and a
 * server action's own message comes back in them too.
 */
export async function getAdminLocale(): Promise<AdminLocale> {
  const store = await cookies();
  const value = store.get(ADMIN_LOCALE_COOKIE)?.value;
  return isAdminLocale(value) ? value : DEFAULT_ADMIN_LOCALE;
}

export async function getAdminT(): Promise<AdminT> {
  return adminT(await getAdminLocale());
}
