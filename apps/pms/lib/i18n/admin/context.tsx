'use client';

import * as React from 'react';
import { DEFAULT_ADMIN_LOCALE, type AdminLocale } from './locale';
import { adminT, type AdminT } from './translate';

const AdminLocaleContext = React.createContext<AdminLocale>(DEFAULT_ADMIN_LOCALE);

/**
 * Seeded by `app/admin/layout.tsx` from the cookie the server already read,
 * so client components render in the same language the server did — there
 * is nothing to correct after mount, unlike the guest site's
 * `LocaleProvider`, and `/admin` stays independent of whatever language a
 * guest picked in this same browser (see `lib/i18n/context.tsx`).
 */
export function AdminLocaleProvider({ locale, children }: { locale: AdminLocale; children: React.ReactNode }) {
  return <AdminLocaleContext.Provider value={locale}>{children}</AdminLocaleContext.Provider>;
}

export function useAdminLocale(): AdminLocale {
  return React.useContext(AdminLocaleContext);
}

export function useAdminT(): AdminT {
  const locale = useAdminLocale();
  return React.useMemo(() => adminT(locale), [locale]);
}
