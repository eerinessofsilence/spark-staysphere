'use client';

import * as React from 'react';
import { ChatCircleDots, PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr';
import type { ChatMessage } from '@/lib/domain/ports';
import { useLocale, useT } from '@/lib/i18n/context';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

const POLL_MS = 8000;

/**
 * The guest's side of `/admin/communications`: a thread on the confirmation
 * page, tied to this booking by its reference and the guest's own email.
 * Sending posts to `/api/conversations`; replies from the desk arrive by
 * polling the thread every few seconds while the page is open. No account,
 * no socket — the reference-plus-email pair the rest of the guest site
 * already trusts is what opens the thread.
 */
export function GuestChat({
  reference,
  email,
  guestName,
  initial,
}: {
  reference: string;
  email: string;
  guestName: string;
  /** The thread as the server rendered it, so the page opens with what was already said. */
  initial: { conversationId: string; messages: ChatMessage[] } | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [conversationId, setConversationId] = React.useState(initial?.conversationId ?? null);
  const [messages, setMessages] = React.useState<ChatMessage[]>(initial?.messages ?? []);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);

  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  // Replies come from the desk whenever it gets to them: poll while the page is open.
  React.useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { messages: ChatMessage[] };
        if (!cancelled) setMessages(data.messages);
      } catch {
        // A missed poll is harmless — the next one catches up.
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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
      const data = (await response.json()) as { conversationId: string; message: ChatMessage };
      setConversationId(data.conversationId);
      setMessages((current) => [...current, data.message]);
      setDraft('');
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="guest-chat-heading" className="mt-8 overflow-hidden rounded-3xl bg-card shadow-soft">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <ChatCircleDots weight="fill" className="size-5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="guest-chat-heading" className="text-base font-semibold">{t('chat.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('chat.intro')}</p>
        </div>
      </div>

      <div ref={scrollerRef} className="max-h-80 overflow-y-auto bg-stone/40 px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('chat.empty')}</p>
        ) : (
          <ol className="grid gap-2">
            {messages.map((message) => {
              const mine = message.from === 'guest';
              return (
                <li key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] sm:max-w-[70%]', mine ? 'text-right' : 'text-left')}>
                    <div className={cn('inline-block rounded-[18px] px-4 py-2.5 text-left text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-card shadow-soft')}>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </div>
                    <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                      {mine ? t('chat.you') : t('chat.hotel')}
                      {mounted ? ` · ${timeFormat.format(new Date(message.sentAt))}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="border-t border-border p-3 sm:p-4"
      >
        <label htmlFor="guest-chat-reply" className="sr-only">{t('chat.title')}</label>
        <div className="flex items-end gap-2 rounded-[22px] border border-border bg-card p-1.5 pl-4 transition-colors focus-within:border-accent">
          <textarea
            id="guest-chat-reply"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={t('chat.placeholder')}
            className="max-h-40 min-h-9 w-full resize-none bg-transparent py-2 text-sm text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={sending || !draft.trim()} aria-label={sending ? t('chat.sending') : t('chat.send')} className={iconButton('dark', 'size-10')}>
            <PaperPlaneTilt weight="fill" className="size-4" aria-hidden="true" />
          </button>
        </div>
        {error ? <p role="alert" className="mt-2 text-sm text-danger">{t('chat.error')}</p> : null}
      </form>
    </section>
  );
}
