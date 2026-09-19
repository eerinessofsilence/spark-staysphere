import type { ReactNode } from 'react';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import type { HotelOption } from './admin-nav';
import {
  AccountMenu,
  AdminBrand,
  AdminFeaturedNav,
  AdminMobileMenu,
  AdminNav,
  PropertyCard,
  type AccountMember,
} from './admin-nav';
import { AdminAssistantLauncher } from '../assistant/admin-assistant-launcher';
import { AdminTour } from '../onboarding/admin-tour';
import { NotificationBell, type RecentBooking } from './notification-bell';
import { Toaster } from './toast';
import { UnsavedChangesGuard } from './unsaved-changes';

interface AdminShellProps {
  /** The team member's own language — `lang` on the shell, since the document's `lang` is the guest site's. */
  locale: AdminLocale;
  /** Who is signed in — the account row at the foot of the sidebar, and the menu that signs them out. */
  member: AccountMember;
  hotelName: string;
  location: string;
  hotels: HotelOption[];
  selectedSlug: string;
  recentBookings: RecentBooking[];
  children: ReactNode;
}

export function AdminShell({ locale, member, hotelName, location, hotels, selectedSlug, recentBookings, children }: AdminShellProps) {
  return (
    <div data-admin-shell lang={locale} className="min-h-dvh lg:grid lg:grid-cols-shell">
      <aside aria-label="Hotel admin" className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="flex h-full flex-col rounded-[18px] bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <AdminBrand />
            <NotificationBell hotelSlug={selectedSlug} bookings={recentBookings} />
          </div>
          <div className="mt-3">
            <PropertyCard hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} />
          </div>
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <AdminNav />
          </div>
          <div className="mt-3 shrink-0">
            <AdminFeaturedNav />
            <div className="mt-3 grid gap-1 border-t border-border pt-3">
              <AccountMenu member={member} />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-40 p-3 lg:hidden">
          <div className="flex h-14 items-center gap-2 rounded-full bg-card pr-2 pl-3 shadow-soft">
            <AdminBrand />
            <div className="min-w-0 flex-1" />
            <NotificationBell hotelSlug={selectedSlug} bookings={recentBookings} />
            <AdminMobileMenu member={member} hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} />
          </div>
        </div>
        {children}
      </div>
      <UnsavedChangesGuard />
      <AdminAssistantLauncher />
      <AdminTour />
      <Toaster />
    </div>
  );
}
