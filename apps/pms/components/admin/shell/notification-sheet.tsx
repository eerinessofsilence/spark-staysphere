'use client';

import Link from 'next/link';
import { BellIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, CurrencyEuroIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { RateChangeEvent } from '@/lib/domain/rate-change-event';
import { Modal } from '@/components/site/modal';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateRange, lRelativeTime } from '@/lib/i18n/format';
import { iconButton, pill } from '@/lib/ui';
import type { RecentBooking, UnreadConversation } from './notification-bell';

export function NotificationSheet({ open, onClose, bookings, rateChanges, conversations, unreadCount }: {
  open: boolean; onClose: () => void; bookings: RecentBooking[]; rateChanges: RateChangeEvent[]; conversations: UnreadConversation[]; unreadCount: number;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const rowClass = 'flex min-h-16 gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-stone focus-visible:outline-2 focus-visible:outline-accent';
  return <Modal open={open} onClose={onClose} title={t('bell.notifications')} chrome={false} sheet className="h-[90dvh] max-h-[90dvh] sm:max-w-2xl">
    <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
      <BellIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <h2 className="min-w-0 flex-1 text-lg font-semibold">{t('bell.notifications')}</h2>
      <button type="button" aria-label={t('menu.close')} onClick={onClose} className={iconButton('light', 'size-10')}><XMarkIcon className="size-5" aria-hidden="true" /></button>
    </header>
    <div data-notifications-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
      {rateChanges.length > 0 ? <section aria-label="Rate changes" className="mb-5"><h3 className="mb-2 px-3 text-sm font-semibold">Rate changes</h3><ul className="grid gap-1">{rateChanges.map((change) => <li key={change.id}><Link href="/admin/rates" onClick={onClose} className={rowClass}><CurrencyEuroIcon className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold">{change.rateName}</span><span className="shrink-0 text-xs text-muted-foreground">{lRelativeTime(change.occurredAt, locale)}</span></span><span className="mt-1 block text-sm text-muted-foreground">{change.description}</span><span className="mt-1 block text-xs text-muted-foreground">{change.actorName}</span></span></Link></li>)}</ul></section> : null}
      {conversations.length > 0 ? <section aria-label={t('bell.messages')} className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3 px-3"><h3 className="text-sm font-semibold">{t('bell.messages')}</h3><span className="text-xs text-muted-foreground">{t('bell.messagesNew', { count: unreadCount })}</span></div>
        <ul className="grid gap-1">{conversations.map((conversation) => <li key={conversation.id}>
          <Link href={`/admin/communications/${conversation.id}${conversation.hotelSlug ? `?hotel=${encodeURIComponent(conversation.hotelSlug)}` : ''}`} onClick={onClose} className={rowClass}>
            <ChatBubbleLeftRightIcon className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold">{conversation.guestName}</span><span className="shrink-0 text-xs text-muted-foreground">{lRelativeTime(conversation.lastMessageAt, locale)}</span></span><span className="mt-1 line-clamp-2 block break-words text-sm text-muted-foreground">{conversation.lastMessage}</span></span>
          </Link>
        </li>)}</ul>
      </section> : null}
      <section aria-label={t('bell.title')}>
        <h3 className="mb-2 px-3 text-sm font-semibold">{t('bell.title')}</h3>
        {bookings.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">{t('bell.empty')}</p> : <ul className="grid gap-1">{bookings.map((booking) => <li key={booking.reference}>
          <Link href={`/admin/bookings/${booking.reference}`} onClick={onClose} className={rowClass}>
            <CalendarDaysIcon className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold">{booking.guestName}</span><span className="shrink-0 text-xs text-muted-foreground">{lRelativeTime(booking.createdAt, locale)}</span></span><span className="mt-1 block text-sm text-muted-foreground">{booking.roomName}</span><span className="mt-1 block text-xs text-muted-foreground">{lDateRange(booking.checkIn, booking.checkOut, locale)}</span></span>
          </Link>
        </li>)}</ul>}
      </section>
    </div>
    <footer className="flex shrink-0 flex-wrap gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Link href="/admin/bookings" onClick={onClose} className={pill('primary', 'flex-1 text-center')}>{t('bell.seeAll')}</Link>
      {conversations.length > 0 ? <Link href="/admin/communications" onClick={onClose} className={pill('secondary', 'flex-1 text-center')}>{t('bell.seeAllMessages')}</Link> : null}
    </footer>
  </Modal>;
}
