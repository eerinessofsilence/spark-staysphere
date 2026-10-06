'use client';

import * as React from 'react';
import { ChatCircleDots, CheckCircle, PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr';
import type { ChatMessage } from '@/lib/application/guest-contracts';
import { markHotelRepliesRead } from '@/lib/guest-message-read';
import { useLocale, useT } from '@/lib/i18n/context';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { NotificationToast } from '@/components/ui/notification-toast';

const POLL_MS = 8000;

export function GuestChat({
  reference,
  email,
  guestName,
  initial,
}: {
  reference: string;
  email: string;
  guestName: string;
  initial: { conversationId: string; messages: ChatMessage[] } | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [conversationId, setConversationId] = React.useState(initial?.conversationId ?? null);
  const [messages, setMessages] = React.useState(initial?.messages ?? []);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [replyNotification, setReplyNotification] = React.useState<string | null>(null);
  const seenMessages = React.useRef(new Set(initial?.messages.map((message) => message.id) ?? []));
  const replyRef = React.useRef<HTMLTextAreaElement>(null);
  const sectionRef = React.useRef<HTMLElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && document.visibilityState === 'visible') {
        markHotelRepliesRead(reference, messages.filter((message) => message.from === 'hotel').map((message) => message.id));
      }
    }, { threshold: 0.5 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [reference, messages]);

  React.useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    const tick = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const response = await fetch(`/api/conversations/${conversationId}?email=${encodeURIComponent(email)}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json() as { messages: ChatMessage[] };
        if (!cancelled) {
          const newReply = data.messages.filter((message) => message.from === 'hotel' && !seenMessages.current.has(message.id)).at(-1);
          for (const message of data.messages) seenMessages.current.add(message.id);
          setMessages(data.messages);
          if (newReply) setReplyNotification(newReply.id);
        }
      } catch {
        // A missed poll is harmless; the next one catches up.
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [conversationId, email]);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(false);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference, name: guestName, email, body }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json() as { conversationId: string; message: ChatMessage };
      seenMessages.current.add(data.message.id);
      setConversationId(data.conversationId);
      setMessages((current) => [...current, data.message]);
      setDraft('');
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  return (
    <>
      {replyNotification ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pt-20 sm:top-auto sm:bottom-0 sm:justify-end sm:p-6 lg:pb-28">
          <NotificationToast
            message={t('chat.newReply')}
            actionLabel={t('chat.viewReply')}
            dismissLabel={t('chat.dismissNotification')}
            onDismiss={() => setReplyNotification(null)}
            onActivate={() => {
              setReplyNotification(null);
              document.getElementById('guest-chat')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              replyRef.current?.focus({ preventScroll: true });
            }}
          />
        </div>
      ) : null}
      <section ref={sectionRef} id="guest-chat" aria-labelledby="guest-chat-heading" className="scroll-mt-28 mt-8 overflow-hidden rounded-3xl bg-card shadow-soft">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <ChatCircleDots weight="fill" className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="guest-chat-heading" className="text-base font-semibold">{t('chat.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('chat.intro')}</p>
          </div>
        </div>
        <div ref={scrollerRef} className="max-h-80 overflow-y-auto bg-stone/40 px-4 py-4" aria-live="polite">
          {messages.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('chat.empty')}</p> : (
            <ol className="grid gap-2">
              {messages.map((message) => {
                const mine = message.from === 'guest';
                if (message.from === 'system') return (
                  <li key={message.id} className="flex justify-center py-1">
                    <div className="flex max-w-[92%] items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground shadow-soft">
                      <CheckCircle weight="fill" className="size-4 shrink-0 text-success" aria-hidden="true" />
                      <span>{message.body}</span>
                      {mounted ? <><span aria-hidden="true">·</span><time dateTime={message.sentAt}>{timeFormat.format(new Date(message.sentAt))}</time></> : null}
                    </div>
                  </li>
                );
                return (
                  <li key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] sm:max-w-[70%]', mine ? 'text-right' : 'text-left')}>
                      <div className={cn('inline-block rounded-[18px] px-4 py-2.5 text-left text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-card shadow-soft')}>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      </div>
                      <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                        {mine ? t('chat.you') : t('chat.hotel')}{mounted ? ` · ${timeFormat.format(new Date(message.sentAt))}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-border p-3 sm:p-4">
          <label htmlFor="guest-chat-reply" className="sr-only">{t('chat.title')}</label>
          <div className="flex items-end gap-2 rounded-[22px] border border-border bg-card p-1.5 pl-4 transition-colors focus-within:border-accent">
            <textarea
              ref={replyRef}
              id="guest-chat-reply"
              disabled={!mounted}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }}
              rows={1}
              placeholder={t('chat.placeholder')}
              className="max-h-40 min-h-9 w-full resize-none bg-transparent py-2 text-sm text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground"
            />
            <button type="submit" disabled={!mounted || sending || !draft.trim()} aria-label={sending ? t('chat.sending') : t('chat.send')} className={iconButton('dark', 'size-10')}>
              <PaperPlaneTilt weight="fill" className="size-4" aria-hidden="true" />
            </button>
          </div>
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{t('chat.error')}</p> : null}
        </form>
      </section>
    </>
  );
}
