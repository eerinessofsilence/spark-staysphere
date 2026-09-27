'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowPathIcon, CalendarDaysIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { sendMessageAction } from '@/app/admin/communications/actions';
import { initialsOf } from '@/lib/application/team-directory';
import type { ChatMessage, Conversation } from '@/lib/domain/ports';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { toast } from '@/components/admin/shell/toast';
import { CHANNEL_ICON, channelKey } from './conversation-list';

/** What the thread header says about the stay, resolved by the page from the booking the thread is tied to. */
export interface ThreadStay {
  reference: string;
  roomName: string;
  dates: string;
}


/** Two messages from the same side within five minutes read as one run: avatar and time once, bubbles close together. */
function sameRun(a: ChatMessage, b: ChatMessage): boolean {
  return a.from === b.from && Math.abs(new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()) < 5 * 60_000;
}

/**
 * One guest's thread: who it is, how they wrote and which stay it is
 * about; the messages as bubbles (guest on the left with their initials,
 * the hotel on the right), grouped into runs and dated when the day
 * changes; the reply box docked underneath. Sending appends through the
 * server action and refreshes the page data; the box keeps focus so a
 * second reply follows straight on.
 */
export function Thread({ conversation, messages, stay }: { conversation: Conversation; messages: ChatMessage[]; stay: ThreadStay | null }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const [draft, setDraft] = React.useState('');
  const [sending, startSending] = React.useTransition();
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const boxRef = React.useRef<HTMLTextAreaElement>(null);
  const Icon = CHANNEL_ICON[conversation.channel];

  // Times are the reader's local time, so they are formatted only in the
  // browser: the server's zone and hour cycle would not match and hydration
  // would trip on the text. Same rule as the list's relative times.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso: string) => (mounted ? dateFormat.format(new Date(iso)) : '');
  const fmtTime = (iso: string) => (mounted ? timeFormat.format(new Date(iso)) : '');
  // Day boundaries follow the same local clock as the labels — the UTC date
  // before mount, the reader's after — or a message sent late in the evening
  // would get its own "today" pill under a "today" that was already there.
  const dayOf = (iso: string) => (mounted ? new Date(iso).toDateString() : iso.slice(0, 10));

  // The newest message is the one to read: land there on open and after every
  // send — by scrolling the thread's own box, not the page, which on a phone
  // would drag the title under the top bar.
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body || sending) return;
    startSending(async () => {
      const result = await sendMessageAction(conversation.id, body);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setDraft('');
      router.refresh();
      boxRef.current?.focus();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-5">
        <Link href="/admin/communications" aria-label={t('comms.back')} className={iconButton('light', 'size-10 lg:hidden')}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </Link>
        <span className="grid size-11 shrink-0 place-content-center rounded-full bg-stone text-sm font-medium" aria-hidden="true">
          {initialsOf(conversation.guestName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-medium">{conversation.guestName}</h2>
            <span className={tag('hidden shrink-0 sm:inline-flex')}>
              <Icon className="size-3.5" aria-hidden="true" />
              {t(channelKey(conversation.channel))}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {stay ? (
              <>
                <CalendarDaysIcon className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                {t('comms.stayLine', { room: stay.roomName, dates: stay.dates })}
                <span className="hidden sm:inline"> · {conversation.guestEmail}</span>
              </>
            ) : (
              <>
                {conversation.guestEmail}
                {conversation.guestPhone ? ` · ${conversation.guestPhone}` : ''}
              </>
            )}
          </p>
        </div>
        {conversation.bookingReference ? (
          <>
            <Link href={`/admin/bookings/${conversation.bookingReference}`} className={pill('secondary', 'hidden min-h-10 shrink-0 px-4 text-sm sm:inline-flex')}>
              {t('comms.openBooking')}
            </Link>
            {/* A phone's header has no room for words next to the name: the booking is the calendar. */}
            <Link href={`/admin/bookings/${conversation.bookingReference}`} aria-label={t('comms.openBooking')} title={t('comms.openBooking')} className={iconButton('light', 'size-10 sm:hidden')}>
              <CalendarDaysIcon className="size-4" aria-hidden="true" />
            </Link>
          </>
        ) : null}
      </header>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto bg-stone/30 px-4 py-4 sm:px-6" aria-live="polite">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('comms.empty.thread')}</p>
        ) : null}
        <ol className="grid gap-1">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const newDay = !previous || dayOf(previous.sentAt) !== dayOf(message.sentAt);
            const startsRun = newDay || !previous || !sameRun(previous, message);
            const endsRun = !next || dayOf(next.sentAt) !== dayOf(message.sentAt) || !sameRun(message, next);
            const mine = message.from === 'hotel';
            return (
              <React.Fragment key={message.id}>
                {newDay ? (
                  <li className={cn('flex justify-center py-3', index > 0 && 'mt-2')} aria-hidden="true">
                    <span className={tag('bg-card text-muted-foreground shadow-soft')}>{fmtDate(message.sentAt) || ' '}</span>
                  </li>
                ) : null}
                <li className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', startsRun && !newDay && 'mt-3')}>
                  {!mine ? (
                    <span className="w-7 shrink-0" aria-hidden="true">
                      {endsRun ? (
                        <span className="grid size-7 place-content-center rounded-full bg-stone text-[10px] font-medium">{initialsOf(conversation.guestName)}</span>
                      ) : null}
                    </span>
                  ) : null}
                  <div className={cn('max-w-[85%] sm:max-w-[68%]', mine ? 'text-right' : 'text-left')}>
                    <div
                      className={cn(
                        'inline-block rounded-[18px] px-4 py-2.5 text-left text-sm',
                        mine ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground shadow-soft',
                        mine && endsRun && 'rounded-br-md',
                        !mine && endsRun && 'rounded-bl-md',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </div>
                    {endsRun ? (
                      <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                        {mine ? `${message.author} · ` : ''}
                        {fmtTime(message.sentAt)}
                      </p>
                    ) : null}
                  </div>
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="border-t border-border p-3 sm:px-5 sm:py-4"
      >
        <label htmlFor="comms-reply" className="sr-only">
          {t('comms.replyLabel')}
        </label>
        <div className="flex items-end gap-2 rounded-[22px] border border-border bg-card p-1.5 pl-4 transition-colors focus-within:border-accent">
          <textarea
            id="comms-reply"
            ref={boxRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={t('comms.replyPlaceholder')}
            className="max-h-40 min-h-9 w-full resize-none bg-transparent py-2 text-sm text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={sending || !draft.trim()} aria-label={sending ? t('comms.sending') : t('comms.send')} className={iconButton('dark', 'size-10')}>
            {sending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : <PaperAirplaneIcon className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="mt-2 hidden text-xs text-muted-foreground sm:block">{t('comms.sendHint')}</p>
      </form>
    </div>
  );
}
