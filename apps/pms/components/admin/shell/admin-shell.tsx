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
import { NotificationBell, type RecentBooking, type UnreadConversation } from './notification-bell';
import { AdminThemeToggle } from './admin-theme-toggle';
import { AdminBadgesProvider } from './admin-badges';
import { Toaster } from './toast';
import { NewBookingNotifier } from './new-booking-notifier';
import { NewMessageNotifier } from './new-message-notifier';
import { UnsavedChangesGuard } from './unsaved-changes';
import type { TeamPermissionKey } from '@/lib/domain/schemas';
import type { RateChangeEvent } from '@/lib/domain/rate-change-event';
import type { SubscriptionAccount } from '@/lib/domain/subscription';
import { SubscriptionNotice, SubscriptionProvider } from '../settings/subscription-provider';

interface AdminShellProps {
  subscriptionAccount: SubscriptionAccount | null;
  subscriptionNow: number;
  /** The team member's own language — `lang` on the shell, since the document's `lang` is the guest site's. */
  locale: AdminLocale;
  /** Who is signed in — the account row at the foot of the sidebar, and the menu that signs them out. */
  member: AccountMember;
  permissions: TeamPermissionKey[];
  hotelName: string;
  location: string;
  hotels: HotelOption[];
  selectedSlug: string;
  messageHotelSlugs: string[];
  recentBookings: RecentBooking[];
  rateChanges: RateChangeEvent[];
  /** Guest threads the desk has not opened — the bell's second section and the badge on the Communications item. */
  unreadConversations: UnreadConversation[];
  unreadMessagesCount: number;
  children: ReactNode;
}

export function AdminShell({ subscriptionAccount, subscriptionNow, locale, member, permissions, hotelName, location, hotels, selectedSlug, messageHotelSlugs, recentBookings, rateChanges, unreadConversations, unreadMessagesCount, children }: AdminShellProps) {
  const unreadMessages = unreadMessagesCount;
  return (
    <SubscriptionProvider account={subscriptionAccount} now={subscriptionNow}>
    <AdminBadgesProvider badges={{ '/admin/communications': unreadMessages }}>
    <div data-admin-shell lang={locale} className="min-h-dvh lg:grid lg:grid-cols-shell">
      <aside aria-label="Hotel admin" className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="flex h-full flex-col rounded-[18px] bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <AdminBrand />
            <div className="flex items-center gap-1">
              <AdminThemeToggle />
              <NotificationBell hotelSlug={selectedSlug} bookings={recentBookings} rateChanges={rateChanges} rateNotificationsEnabled={permissions.includes('team.permEditRates')} conversations={unreadConversations} unreadMessagesCount={unreadMessagesCount} />
            </div>
          </div>
          <div className="mt-3">
            <PropertyCard hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} />
          </div>
          <div className="no-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto">
            <AdminNav permissions={permissions} />
          </div>
          <div className="mt-3 shrink-0">
            <AdminFeaturedNav permissions={permissions} />
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
            <NotificationBell hotelSlug={selectedSlug} bookings={recentBookings} rateChanges={rateChanges} rateNotificationsEnabled={permissions.includes('team.permEditRates')} conversations={unreadConversations} unreadMessagesCount={unreadMessagesCount} />
            <AdminMobileMenu member={member} permissions={permissions} hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} />
          </div>
        </div>
        <SubscriptionNotice />
        {children}
      </div>
      <UnsavedChangesGuard />
      <AdminAssistantLauncher />
      <AdminTour />
      <NewBookingNotifier hotelSlug={selectedSlug} initialReferences={recentBookings.map((booking) => booking.reference)} />
      <NewMessageNotifier hotelSlugs={messageHotelSlugs} initialConversations={unreadConversations} />
      <Toaster />
    </div>
    </AdminBadgesProvider>
    </SubscriptionProvider>
  );
}
