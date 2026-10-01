'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { BellIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateRange, lRelativeTime } from '@/lib/i18n/format';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

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
  conversations = [],
  unreadMessagesCount,
}: {
  hotelSlug: string;
  bookings: RecentBooking[];
  conversations?: UnreadConversation[];
  unreadMessagesCount?: number;
}) {
  const [unseenBookings, setUnseenBookings] = React.useState(0);
  const [visibleBookings, setVisibleBookings] = React.useState(INITIAL_VISIBLE_BOOKINGS);
  // Unread messages are a server-side count, so they show from the first
  // paint; the bookings half waits for localStorage below.
  const unreadMessages = unreadMessagesCount ?? conversations.reduce((sum, c) => sum + c.unread, 0);
  const unseenCount = unseenBookings + unreadMessages;
  const locale = useAdminLocale();
  const t = useAdminT();

  // Read after mount, not during the server render: localStorage doesn't
  // exist there, and guessing "0" up front matches what SSR sent, so there
  // is nothing to reconcile — the badge just fades in a moment later.
  React.useEffect(() => {
    const lastSeen = readLastSeen(hotelSlug);
    setUnseenBookings(bookings.filter((booking) => booking.createdAt > lastSeen).length);
  }, [hotelSlug, bookings]);

  function onOpenChange(open: boolean) {
    if (!open) return;
    setVisibleBookings(INITIAL_VISIBLE_BOOKINGS);
    if (bookings.length === 0) return;
    writeLastSeen(hotelSlug, bookings[0]!.createdAt);
    setUnseenBookings(0);
  }

  return (
    <Menu.Root modal={false} onOpenChange={onOpenChange}>
      <Menu.Trigger
        data-tour="bell"
        aria-label={unseenCount > 0 ? t('bell.newTotal', { count: unseenCount }) : t('bell.reservations')}
        className={cn(iconButton('light'), 'relative')}
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
            {conversations.length > 0 ? (
              <>
                <p className="flex items-center justify-between px-3 py-2 text-sm font-medium">
                  {t('bell.messages')}
                  <span className="text-xs font-normal text-muted-foreground">{t('bell.messagesNew', { count: unreadMessages })}</span>
                </p>
                {conversations.slice(0, 5).map((conversation) => (
                  <Menu.LinkItem
                    key={conversation.id}
                    render={<Link href={`/admin/communications/${conversation.id}`} />}
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
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
