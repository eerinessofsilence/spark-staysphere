import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { AdminLocaleProvider } from '@/lib/i18n/admin/context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { CmsShell } from '@/components/admin/cms-shell';

export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');
  const [hotel, locale] = await Promise.all([catalogService.getHotel(DEMO_HOTEL_SLUG), getAdminLocale()]);
  return <AdminLocaleProvider locale={locale}><CmsShell hotelName={hotel.name} location={hotel.location} selectedSlug={hotel.slug} locale={locale} role={session.role}>{children}</CmsShell></AdminLocaleProvider>;
}
