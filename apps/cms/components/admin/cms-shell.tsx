import type { ReactNode } from 'react';
import { AdminBrand, AdminNav, AdminFeaturedNav, AdminMobileMenu, AccountMenu, PropertyCard } from './shell/admin-nav';
import { AdminThemeToggle } from './shell/admin-theme-toggle';
import { Toaster } from './shell/toast';
import { UnsavedChangesGuard } from './shell/unsaved-changes';
import { adminT } from '@/lib/i18n/admin/translate';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import type { TeamPermissionKey } from '@/lib/domain/schemas';

export function CmsShell({ hotelName, location, selectedSlug, locale, role, children }: {
  hotelName: string; location: string; selectedSlug: string; locale: AdminLocale;
  role: 'admin' | 'editor'; children: ReactNode;
}) {
  const t = adminT(locale);
  const roleLabel = t(role === 'admin' ? 'role.admin' : 'role.contentEditor');
  const member = { id: role, name: roleLabel, roleLabel: 'StaySphere CMS' };
  const permissions: TeamPermissionKey[] = ['team.permEditContent', 'team.permEditRates', ...(role === 'admin' ? ['team.permBrandDomain' as const] : [])];
  const hotels = [{ name: hotelName, location, slug: selectedSlug }];
  return (
    <div data-admin-shell lang={locale} className="min-h-dvh lg:grid lg:grid-cols-shell">
      <a href="#main" className="sr-only focus:not-sr-only">{t('cms.skipToContent')}</a>
      <aside aria-label={t('nav.admin')} className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="flex h-full flex-col rounded-[18px] bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <AdminBrand />
            <AdminThemeToggle />
          </div>
          <div className="mt-3"><PropertyCard hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} /></div>
          <div className="no-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto"><AdminNav permissions={permissions} /></div>
          <div className="mt-3 shrink-0">
            <AdminFeaturedNav permissions={permissions} />
            <div className="mt-3 grid gap-1 border-t border-border pt-3"><AccountMenu member={member} /></div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-40 p-3 lg:hidden">
          <div className="flex h-14 items-center gap-2 rounded-full bg-card pr-2 pl-3 shadow-soft">
            <AdminBrand /><div className="min-w-0 flex-1" /><AdminThemeToggle />
            <AdminMobileMenu member={member} permissions={permissions} hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} />
          </div>
        </div>
        {children}
      </div>
      <UnsavedChangesGuard />
      <Toaster />
    </div>
  );
}
