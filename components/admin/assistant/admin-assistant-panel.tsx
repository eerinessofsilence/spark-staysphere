'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Sparkle } from '@phosphor-icons/react/dist/ssr';
import { applyAdminProposalAction, askAdminAssistantAction, type AdminAskResponse } from '@/app/admin/assistant/actions';
import type { AdminAskResult } from '@/lib/application/admin-assistant-service';
import { MAX_UTTERANCE_LENGTH } from '@/lib/application/assistant-service';
import type { AdminDraft, AdminProposal } from '@/lib/domain/admin-assistant';
import type { AdminChatTurn } from '@/lib/domain/ports';
import { formatAdminApplyOutcome, formatAdminAssistantReply, formatAdminProposal, formatAdminQuestion } from '@/lib/formatting';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { useOverlayTransition } from '@/components/site/use-overlay-transition';
import { toast } from '@/components/admin/shell/toast';

// Every example resolves through the keyword fallback too, so a keyless
// demo answers each of them — same rule as the guest panel's chips. They stay
// English in every admin language: a chip is the request it sends, not a
// label, and translating it would send a request the keyless fallback (still
// English-only) could no longer resolve.
const EXAMPLES = ['Create a room type and a room for it', 'Set Deluxe Sea View to 320 a night', 'Mark Panorama Suite sold out', 'Open room rates'];

/** Turns kept for the interpreter's context — the thread itself is not sent whole. */
const HISTORY_TURNS = 10;

interface Message {
  id: number;
  role: 'admin' | 'assistant';
  text: string;
  /** The message this one answered, so an ambiguity chip can re-ask it with the pick filled in. */
  answering?: { utterance: string; target: string };
  candidates?: string[];
  proposal?: AdminProposal;
  proposalState?: 'pending' | 'applied' | 'dismissed';
  note?: string;
}

interface AdminAssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

let nextId = 1;

/**
 * The admin assistant as a chat window: it docks above its launcher and
 * leaves the page underneath usable — no backdrop, no scroll lock — because
 * setting a hotel up is done alongside the screens it changes, not instead
 * of them. What the assistant still needs comes back as a question; what it
 * would change comes back as a proposal card with an Apply button; the
 * conversation's state (`draft`) is held here and sent with every message.
 * Every sentence shown is composed in `lib/formatting.ts` from the
 * proposal's own names and numbers, never taken from the model.
 */
export function AdminAssistantPanel({ open, onClose }: AdminAssistantPanelProps) {
  const router = useRouter();
  const locale = useAdminLocale();
  const t = useAdminT();
  const [mounted, setMounted] = React.useState(false);
  const { rendered, visible } = useOverlayTransition(open);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState<AdminDraft | null>(null);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const threadRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => window.clearTimeout(timer);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // The newest message is the one being read: keep it in view.
  React.useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  function push(message: Omit<Message, 'id'>) {
    setMessages((current) => [...current, { ...message, id: nextId++ }]);
  }

  function history(): AdminChatTurn[] {
    return messages.slice(-HISTORY_TURNS).map((message) => ({ role: message.role, text: message.text }));
  }

  async function send(utterance: string) {
    const text = utterance.trim();
    if (!text || busy) return;
    setInput('');
    push({ role: 'admin', text });
    setBusy(true);

    let response: AdminAskResponse;
    try {
      response = await askAdminAssistantAction({ utterance: text, draft, history: history() });
    } catch {
      setBusy(false);
      push({ role: 'assistant', text: t('assistant.error.unreachable') });
      return;
    }
    setBusy(false);

    if (!response.ok) {
      push({
        role: 'assistant',
        text:
          response.error === 'too_many_requests'
            ? t('assistant.error.tooMany')
            : response.error === 'busy'
              ? t('assistant.error.busy')
              : t('assistant.error.unknown'),
      });
      return;
    }

    const { result } = response;
    setDraft(result.outcome === 'question' ? result.draft : null);
    push({
      role: 'assistant',
      text: formatAdminAssistantReply(result, locale),
      ...(result.outcome === 'ambiguous' ? { candidates: result.candidates, answering: { utterance: text, target: result.target } } : {}),
      ...(result.outcome === 'proposal' ? { proposal: result.proposal, proposalState: 'pending' as const } : {}),
      note: noteFor(result, response.interpretedBy),
    });
  }

  function noteFor(result: AdminAskResult, interpretedBy: 'openai' | 'keyword'): string | undefined {
    const parts: string[] = [];
    if (result.outcome === 'proposal' && result.unresolved.length > 0) parts.push(t('assistant.note.ignored', { items: result.unresolved.join(', ') }));
    if (interpretedBy === 'keyword' && result.usedInterpreter) parts.push(t('assistant.note.keywords'));
    return parts.length ? parts.join(' · ') : undefined;
  }

  async function apply(message: Message) {
    const proposal = message.proposal;
    if (!proposal || busy) return;

    if (proposal.kind === 'navigate') {
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, proposalState: 'applied' } : item)));
      router.push(proposal.href);
      return;
    }

    setBusy(true);
    const result = await applyAdminProposalAction(proposal);
    setBusy(false);
    const text = formatAdminApplyOutcome(result, proposal, locale);

    if (!result.ok) {
      push({ role: 'assistant', text });
      return;
    }

    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, proposalState: 'applied' } : item)));
    toast.success(text);
    router.refresh();
    push({ role: 'assistant', text });

    if (result.followUp) {
      setDraft(result.followUp);
      push({ role: 'assistant', text: formatAdminQuestion('number', result.followUp, locale) });
    }
  }

  function dismiss(message: Message) {
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, proposalState: 'dismissed' } : item)));
    setDraft(null);
    push({ role: 'assistant', text: t('assistant.droppedWhatElse') });
    inputRef.current?.focus();
  }

  if (!rendered || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={t('assistant.title')}
      className={cn(
        'glass fixed z-40 flex flex-col overflow-hidden rounded-[18px] shadow-soft-lg outline-none transition-[opacity,translate,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
        // Docked above the launcher, which stays as the toggle; the page beside it stays usable.
        'right-3 bottom-[calc(10rem+env(safe-area-inset-bottom))] left-3 max-h-[min(34rem,calc(100dvh-12rem))] sm:right-6 sm:left-auto sm:w-[26rem] lg:bottom-[6.5rem]',
        visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-0',
      )}
      style={{ transformOrigin: 'bottom right' }}
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary">
          <Sparkle weight="fill" className={cn('size-4 text-primary-foreground', busy && 'animate-pulse')} aria-hidden="true" />
        </span>
        <p className="flex-1 text-sm font-medium">{t('assistant.title')}</p>
        {draft ? <span className="text-xs text-muted-foreground">{t('assistant.settingUp')}</span> : null}
      </div>

      <div ref={threadRef} className="flex-1 overflow-y-auto p-3" role="log" aria-live="polite">
        <div className="grid gap-2">
          <Bubble role="assistant">{t('assistant.welcome')}</Bubble>
          {messages.length === 0 ? (
            <>
              <ul className="flex flex-wrap gap-1.5 pl-1" lang="en">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button type="button" onClick={() => void send(example)} className={pill('secondary', 'min-h-9 px-3 text-xs font-medium')}>
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {messages.map((message) => (
            <React.Fragment key={message.id}>
              <Bubble role={message.role}>{message.text}</Bubble>

              {message.candidates && message.answering ? (
                <ul className="flex flex-wrap gap-1.5 pl-1">
                  {message.candidates.map((candidate) => (
                    <li key={candidate}>
                      <button
                        type="button"
                        onClick={() => void send(replaceTarget(message.answering!.utterance, message.answering!.target, candidate))}
                        className={pill('secondary', 'min-h-9 px-3 text-xs font-medium')}
                      >
                        {candidate}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {message.proposal ? (
                <ProposalCard
                  proposal={message.proposal}
                  state={message.proposalState ?? 'pending'}
                  busy={busy}
                  onApply={() => void apply(message)}
                  onDismiss={() => dismiss(message)}
                />
              ) : null}

              {message.note ? <p className="pl-1 text-[11px] text-muted-foreground">{message.note}</p> : null}
            </React.Fragment>
          ))}

          {busy ? <Bubble role="assistant">…</Bubble> : null}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-border/60 p-2.5"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value.slice(0, MAX_UTTERANCE_LENGTH))}
          placeholder={draft ? t('assistant.answerPlaceholder') : t('assistant.placeholder')}
          aria-label={t('assistant.inputLabel')}
          maxLength={MAX_UTTERANCE_LENGTH}
          className={cn(fieldClass, 'min-h-11 text-sm')}
        />
        <button type="submit" aria-label={t('assistant.send')} disabled={busy || !input.trim()} className={iconButton('dark', 'size-10')}>
          {busy ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : <PaperAirplaneIcon className="size-4" aria-hidden="true" />}
        </button>
      </form>
    </div>,
    document.body,
  );
}

function Bubble({ role, children }: { role: 'admin' | 'assistant'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-snug',
        role === 'admin' ? 'justify-self-end rounded-br-md bg-primary text-primary-foreground' : 'justify-self-start rounded-bl-md bg-card text-foreground',
      )}
    >
      {children}
    </p>
  );
}

function ProposalCard({
  proposal,
  state,
  busy,
  onApply,
  onDismiss,
}: {
  proposal: AdminProposal;
  state: 'pending' | 'applied' | 'dismissed';
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const locale = useAdminLocale();
  const t = useAdminT();
  const { lead, detail } = formatAdminProposal(proposal, locale);
  return (
    <div className={cn('max-w-[92%] rounded-2xl border border-border bg-card p-3.5', state !== 'pending' && 'opacity-60')}>
      <p className="text-display text-base">{lead}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      {state === 'pending' ? (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onDismiss} disabled={busy} className={pill('secondary', 'min-h-9 px-4 text-xs')}>
            {t('assistant.notThat')}
          </button>
          <button type="button" onClick={onApply} disabled={busy} className={pill('primary', 'min-h-9 flex-1 justify-center text-xs')}>
            {proposal.kind === 'navigate' ? t('assistant.open') : t('assistant.apply')}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs font-medium text-muted-foreground">{state === 'applied' ? t('assistant.done') : t('assistant.dropped')}</p>
      )}
    </div>
  );
}

function replaceTarget(utterance: string, target: string, candidate: string): string {
  const pattern = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return pattern.test(utterance) ? utterance.replace(pattern, candidate) : `${utterance} ${candidate}`;
}
