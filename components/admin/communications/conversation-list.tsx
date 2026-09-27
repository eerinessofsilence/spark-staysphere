'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChatBubbleLeftEllipsisIcon, ChatBubbleOvalLeftIcon, DevicePhoneMobileIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { initialsOf } from '@/lib/application/team-directory';
import type { Conversation, ConversationChannel } from '@/lib/domain/ports';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lRelativeTime } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';

export const CHANNEL_ICON: Record<ConversationChannel, typeof EnvelopeIcon> = {
  chat: ChatBubbleOvalLeftIcon,
  email: EnvelopeIcon,
  whatsapp: ChatBubbleLeftEllipsisIcon,
  sms: DevicePhoneMobileIcon,
};

export function channelKey(channel: ConversationChannel) {
  return `comms.channel.${channel}` as const;
}

type Filter = 'all' | 'unread' | ConversationChannel;
const FILTERS: Filter[] = ['all', 'unread', 'chat', 'whatsapp', 'email', 'sms'];

/**
 * The inbox's left column: search, one row of filter chips (everything,
 * unread, or one channel — each with its count), then the threads newest
 * first. A row is the guest, the channel and booking, the last line and
 * when it came; an unread thread reads bold and carries its count. The
 * open thread is lit the way the sidebar lights its page.
 */
export function ConversationList({ conversations, currentId, action }: { conversations: Conversation[]; currentId: string | null; action?: React.ReactNode }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  // Relative times move between the server render and hydration, so they wait for mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const counts: Record<Filter, number> = {
    all: conversations.length,
    unread: conversations.filter((c) => c.unread > 0).length,
    chat: conversations.filter((c) => c.channel === 'chat').length,
    whatsapp: conversations.filter((c) => c.channel === 'whatsapp').length,
    email: conversations.filter((c) => c.channel === 'email').length,
    sms: conversations.filter((c) => c.channel === 'sms').length,
  };
  const needle = query.trim().toLowerCase();
  const visible = conversations.filter((c) => {
    if (filter === 'unread' && c.unread === 0) return false;
    if (filter !== 'all' && filter !== 'unread' && c.channel !== filter) return false;
    if (!needle) return true;
    return [c.guestName, c.guestEmail, c.bookingReference ?? '', c.lastMessage].some((field) => field.toLowerCase().includes(needle));
  });

  function filterLabel(key: Filter): string {
    if (key === 'all') return t('comms.filter.all');
    if (key === 'unread') return t('comms.filter.unread');
    return t(channelKey(key));
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <div className="grid gap-3 border-b border-border p-3 pt-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <h1 className="text-display text-xl">{t('comms.title')}</h1>
          {action}
        </div>
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('comms.search')} aria-label={t('comms.search')} />
        <div role="group" aria-label={t('comms.filterLabel')} className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
          {FILTERS.filter((key) => key === 'all' || counts[key] > 0).map((key) => {
            const current = key === filter;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={current}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                  current ? 'bg-primary text-primary-foreground' : 'bg-stone text-muted-foreground hover:text-foreground',
                )}
              >
                {filterLabel(key)}
                <span className={cn('tabular-nums', current ? 'text-primary-foreground/70' : 'text-muted-foreground/80')}>{counts[key]}</span>
              </button>
            );
          })}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{needle || filter !== 'all' ? t('comms.noMatch') : t('comms.empty')}</p>
      ) : (
        <ul aria-label={t('comms.listCaption')} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {visible.map((c) => {
            const Icon = CHANNEL_ICON[c.channel];
            const current = c.id === currentId;
            const unread = c.unread > 0;
            return (
              <li key={c.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/admin/communications/${c.id}`}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'relative flex gap-3 px-4 py-3 transition-colors hover:bg-stone/60',
                    current && 'bg-stone',
                    current && 'before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r before:bg-primary',
                  )}
                >
                  <span className="relative shrink-0" aria-hidden="true">
                    <span className={cn('grid size-10 place-content-center rounded-full text-xs font-medium', unread ? 'bg-primary text-primary-foreground' : 'bg-stone')}>
                      {initialsOf(c.guestName)}
                    </span>
                    <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-content-center rounded-full border-2 border-card bg-card">
                      <Icon className="size-3 text-muted-foreground" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('min-w-0 truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{c.guestName}</span>
                      <span className={cn('shrink-0 text-xs', unread ? 'font-medium text-foreground' : 'text-muted-foreground')} suppressHydrationWarning>
                        {mounted ? lRelativeTime(c.lastMessageAt, locale) : ''}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn('min-w-0 truncate text-sm', unread ? 'text-foreground' : 'text-muted-foreground')}>
                        {c.lastMessage || '…'}
                      </span>
                      {unread ? (
                        <span className="grid h-5 min-w-5 shrink-0 place-content-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                          <span className="sr-only">{t('comms.unread', { count: String(c.unread) })}</span>
                          <span aria-hidden="true">{c.unread}</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t(channelKey(c.channel))}
                      {c.bookingReference ? ` · ${c.bookingReference}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
