'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { BellIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, CurrencyEuroIcon } from '@heroicons/react/24/outline';
import type { RateChangeEvent } from '@/lib/domain/rate-change-event';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateRange, lRelativeTime } from '@/lib/i18n/format';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { NotificationSheet } from './notification-sheet';

export interface MaintenanceIssueNotice {
  id: string;
  issueId: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  href: string;
}

export interface RecentBooking {
  reference: string;
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  createdAt: string;
}

/** A guest thread nobody has opened yet — counted server side, so it needs no "last seen" of its own. */
export interface UnreadConversation {
  id: string;
  guestName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  hotelSlug: string;
}

const STORAGE_PREFIX = 'admin-notifications.last-seen.';
const INITIAL_VISIBLE_BOOKINGS = 5;
const BOOKINGS_PER_PAGE = 5;

// localStorage can throw: private mode, cookies blocked, a cross-origin
// iframe. Missing "last seen" just means everything reads as new — not
// worth crashing over. Same rationale as the spinner editor's own
// `shortcuts-panel.tsx`.
function readLastSeen(hotelSlug: string): string {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + hotelSlug) ?? '';
  } catch {
    return '';
  }
}

function writeLastSeen(hotelSlug: string, iso: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + hotelSlug, iso);
  } catch {
    // Not remembered — the badge just recomputes from scratch next load.
  }
}

/**
 * A bell over the most recently made bookings for the selected hotel, so a
 * new one doesn't go unnoticed between visits to Reservations. There is no
 * per-user session yet (`CLAUDE.md`'s documented gap — auth is future work),
 * so "seen" is remembered in this browser, per hotel, rather than server
 * side: opening the panel marks every booking in it as seen.
 */
export function NotificationBell({
  hotelSlug,
  bookings,
  rateChanges = [],
  rateNotificationsEnabled = false,
  conversations = [],
  unreadMessagesCount,
  maintenanceNotificationsEnabled = false,
  bookingNotificationsEnabled = true,
}: {
  hotelSlug: string;
  bookings: RecentBooking[];
  rateChanges?: RateChangeEvent[];
  rateNotificationsEnabled?: boolean;
  conversations?: UnreadConversation[];
  unreadMessagesCount?: number;
  maintenanceNotificationsEnabled?: boolean;
  bookingNotificationsEnabled?: boolean;
}) {
  const [unseenBookings, setUnseenBookings] = React.useState(0);
  const [unseenRates, setUnseenRates] = React.useState(0);
  const [liveRateChanges, setLiveRateChanges] = React.useState(rateChanges);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const [visibleBookings, setVisibleBookings] = React.useState(INITIAL_VISIBLE_BOOKINGS);
  const [liveConversations, setLiveConversations] = React.useState(conversations);
  const [liveUnreadCount, setLiveUnreadCount] = React.useState(unreadMessagesCount ?? conversations.reduce((sum, c) => sum + c.unread, 0));
  const [maintenanceNotifications, setMaintenanceNotifications] = React.useState<MaintenanceIssueNotice[]>([]);
  const unseenMaintenance = maintenanceNotifications.filter((item) => !item.readAt).length;
  const unreadMessages = liveUnreadCount;
  const unseenCount = unseenBookings + unseenRates + unreadMessages + unseenMaintenance;
  const locale = useAdminLocale();
  const t = useAdminT();

  // Read after mount, not during the server render: localStorage doesn't
  // exist there, and guessing "0" up front matches what SSR sent, so there
  // is nothing to reconcile — the badge just fades in a moment later.
  React.useEffect(() => {
    const lastSeen = readLastSeen(hotelSlug);
    setUnseenBookings(bookings.filter((booking) => booking.createdAt > lastSeen).length);
  }, [hotelSlug, bookings]);

  React.useEffect(() => {
    setLiveRateChanges(rateChanges);
    setUnseenRates(rateChanges.filter((change) => change.occurredAt > readLastSeen(`${hotelSlug}.rates`)).length);
  }, [hotelSlug, rateChanges]);

  React.useEffect(() => {
    if (!rateNotificationsEnabled) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/admin/rate-notifications?hotel=${encodeURIComponent(hotelSlug)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { changes: RateChangeEvent[] };
        if (!active) return;
        setLiveRateChanges(data.changes);
        setUnseenRates(data.changes.filter((change) => change.occurredAt > readLastSeen(`${hotelSlug}.rates`)).length);
      } catch { /* Keep the last loaded notifications if the poll fails. */ }
    };
    const timer = window.setInterval(refresh, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [hotelSlug, rateNotificationsEnabled]);

  React.useEffect(() => {
    if (!maintenanceNotificationsEnabled) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/admin/maintenance-notifications?hotel=all', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { notifications: MaintenanceIssueNotice[] };
        if (active) setMaintenanceNotifications(data.notifications);
      } catch { /* Retain persistent notices already loaded. */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [maintenanceNotificationsEnabled]);

  React.useEffect(() => {
    setLiveConversations(conversations);
    setLiveUnreadCount(unreadMessagesCount ?? conversations.reduce((sum, conversation) => sum + conversation.unread, 0));
  }, [conversations, unreadMessagesCount]);

  React.useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ conversations: UnreadConversation[]; unreadCount: number }>).detail;
      setLiveConversations(detail.conversations);
      setLiveUnreadCount(detail.unreadCount);
    };
    window.addEventListener('admin-unread-messages', receive);
    return () => window.removeEventListener('admin-unread-messages', receive);
  }, []);

  function onOpenChange(open: boolean) {
    if (!open) return;
    setVisibleBookings(INITIAL_VISIBLE_BOOKINGS);
    if (bookings[0]) writeLastSeen(hotelSlug, bookings[0].createdAt);
    setUnseenBookings(0);
    if (liveRateChanges[0]) writeLastSeen(`${hotelSlug}.rates`, liveRateChanges[0].occurredAt);
    setUnseenRates(0);
  }

  return (
    <>
    <button type="button" data-tour="bell" disabled={!hydrated} aria-label={unseenCount > 0 ? t('bell.newTotal', { count: unseenCount }) : t('bell.notifications')}
      onClick={() => { onOpenChange(true); setMobileOpen(true); }} className={cn(iconButton('light'), 'relative lg:hidden')}>
      <BellIcon className="size-5" aria-hidden="true" />
      {unseenCount > 0 ? <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">{unseenCount > 9 ? '9+' : unseenCount}</span> : null}
    </button>
    <NotificationSheet open={mobileOpen} onClose={() => setMobileOpen(false)} bookings={bookings} rateChanges={liveRateChanges} conversations={liveConversations} unreadCount={unreadMessages} maintenanceNotifications={maintenanceNotifications} maintenanceEnabled={maintenanceNotificationsEnabled} bookingNotificationsEnabled={bookingNotificationsEnabled} />
    <Menu.Root modal={false} onOpenChange={onOpenChange}>
      <Menu.Trigger
        data-tour="bell"
        aria-label={unseenCount > 0 ? t('bell.newTotal', { count: unseenCount }) : t('bell.notifications')}
        className={cn(iconButton('light'), 'relative hidden lg:inline-flex')}
      >
        <BellIcon className="size-5" aria-hidden="true" />
        {unseenCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground"
          >
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        ) : null}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={8} className="z-50 outline-none">
        <Menu.Popup className="max-h-[min(80dvh,40rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
            {maintenanceNotifications.length > 0 ? <>
              <p className="px-3 py-2 text-sm font-medium">{t('nav.maintenance')}</p>
              {maintenanceNotifications.slice(0, 5).map((notice) => <Menu.LinkItem key={notice.id} render={<Link href={notice.href} />} closeOnClick className="flex min-h-11 w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left outline-none select-none data-highlighted:bg-stone">
                <span className="flex items-baseline justify-between gap-2 text-sm font-medium"><span className="truncate">{notice.title}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{lRelativeTime(notice.createdAt, locale)}</span></span>
                <span className="truncate text-xs text-muted-foreground">{notice.message}</span>
              </Menu.LinkItem>)}
              <div className="my-1.5 border-t border-border" role="separator" />
            </> : null}
            {liveRateChanges.length > 0 ? <>
              <p className="px-3 py-2 text-sm font-medium">Rate changes</p>
              {liveRateChanges.slice(0, 5).map((change) => <Menu.LinkItem key={change.id} render={<Link href="/admin/rates" />} closeOnClick className="flex min-h-11 w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left outline-none select-none data-highlighted:bg-stone">
                <span className="flex items-baseline justify-between gap-2 text-sm font-medium"><span className="truncate">{change.rateName}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{lRelativeTime(change.occurredAt, locale)}</span></span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><CurrencyEuroIcon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{change.description} · {change.actorName}</span></span>
              </Menu.LinkItem>)}
              <div className="my-1.5 border-t border-border" role="separator" />
            </> : null}
            {liveConversations.length > 0 ? (
              <>
                <p className="flex items-center justify-between px-3 py-2 text-sm font-medium">
                  {t('bell.messages')}
                  <span className="text-xs font-normal text-muted-foreground">{t('bell.messagesNew', { count: unreadMessages })}</span>
                </p>
                {liveConversations.slice(0, 5).map((conversation) => (
                  <Menu.LinkItem
                    key={conversation.id}
                    render={<Link href={`/admin/communications/${conversation.id}${conversation.hotelSlug ? `?hotel=${encodeURIComponent(conversation.hotelSlug)}` : ''}`} />}
                    closeOnClick
                    className="flex min-h-11 w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left outline-none select-none data-highlighted:bg-stone"
                  >
                    <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
                      <span className="truncate">{conversation.guestName}</span>
                      <span className="shrink-0 text-xs font-normal text-muted-foreground">
                        {lRelativeTime(conversation.lastMessageAt, locale)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ChatBubbleLeftRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{conversation.lastMessage}</span>
                    </span>
                  </Menu.LinkItem>
                ))}
                <Menu.LinkItem
                  render={<Link href="/admin/communications" />}
                  closeOnClick
                  className="mt-1 flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-muted-foreground outline-none select-none data-highlighted:bg-stone data-highlighted:text-foreground"
                >
                  {t('bell.seeAllMessages')}
                </Menu.LinkItem>
                <div className="my-1.5 border-t border-border" role="separator" />
              </>
            ) : null}
            {maintenanceNotificationsEnabled ? <Menu.LinkItem render={<Link href="/admin/maintenance" />} closeOnClick
              className="mt-1 flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-muted-foreground outline-none select-none data-highlighted:bg-stone data-highlighted:text-foreground">
              {t('maintenance.showAll')}
            </Menu.LinkItem> : null}
            {bookingNotificationsEnabled ? <>
            <p className="px-3 py-2 text-sm font-medium">{t('bell.title')}</p>
            {bookings.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-muted-foreground">{t('bell.empty')}</p>
            ) : (
              bookings.slice(0, visibleBookings).map((booking) => (
                <Menu.LinkItem
                  key={booking.reference}
                  render={<Link href={`/admin/bookings/${booking.reference}`} />}
                  // Base UI leaves a link item open by default, expecting a full page load
                  // to end the menu; a client-side Link changes the page underneath it.
                  closeOnClick
                  className="flex min-h-11 w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left outline-none select-none data-highlighted:bg-stone"
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
                    <span className="truncate">{booking.guestName}</span>
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      {lRelativeTime(booking.createdAt, locale)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDaysIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    {booking.roomName} · {lDateRange(booking.checkIn, booking.checkOut, locale)}
                  </span>
                </Menu.LinkItem>
              ))
            )}
            {visibleBookings < bookings.length ? (
              <Menu.Item
                closeOnClick={false}
                onClick={() => setVisibleBookings((count) => Math.min(count + BOOKINGS_PER_PAGE, bookings.length))}
                className="mt-1 flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-muted-foreground outline-none select-none data-highlighted:bg-stone data-highlighted:text-foreground"
              >
                {t('bell.showMore')}
              </Menu.Item>
            ) : null}
            <Menu.LinkItem
              render={<Link href="/admin/bookings" />}
              closeOnClick
              className="mt-1 flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-muted-foreground outline-none select-none data-highlighted:bg-stone data-highlighted:text-foreground"
            >
              {t('bell.seeAll')}
            </Menu.LinkItem>
            </> : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    </>
  );
}
