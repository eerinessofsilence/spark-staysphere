'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Sparkle } from '@phosphor-icons/react/dist/ssr';
import { applyAdminProposalAction, askAdminAssistantAction, reviewAssistantAddOnAction, type AdminAskResponse } from '@/app/admin/assistant/actions';
import type { AdminAskResult } from '@/lib/application/admin-assistant-service';
import { MAX_UTTERANCE_LENGTH } from '@/lib/application/assistant-service';
import type { RateRecommendationResult } from '@/lib/application/rate-recommendations';
import { addOnDraftFields, type AdminDraft, type AdminProposal } from '@/lib/domain/admin-assistant';
import type { AdminChatTurn } from '@/lib/domain/ports';
import { formatAdminApplyOutcome, formatAdminAssistantReply, formatAdminProposal, formatAdminQuestion } from '@/lib/formatting';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lAddOnCategory, lMoney, lPricingUnit } from '@/lib/i18n/format';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { useOverlayTransition } from '@/components/site/use-overlay-transition';
import { toast } from '@/components/admin/shell/toast';
import styles from './admin-assistant-panel.module.css';
import { ServicePhotosStep } from './service-photos-step';

// Every example resolves through the keyword fallback too, so a keyless
// demo answers each of them — same rule as the guest panel's chips. They stay
// English in every admin language: a chip is the request it sends, not a
// label, and translating it would send a request the keyless fallback (still
// English-only) could no longer resolve.
const EXAMPLES = [
  'Create a room type and a room for it',
  'Create a rate for Deluxe Sea View',
  'Create a service',
  'Set Deluxe Sea View to 320 a night',
  'Mark Panorama Suite sold out',
  'Open room rates',
];

/** Turns kept for the interpreter's context — the thread itself is not sent whole. */
const HISTORY_TURNS = 10;
const RATE_ADVICE_PATTERN = /(?:recommend|suggest|analy[sz]e|advice|совет|рекоменд|анализ|подскаж|empfehl|analysier).*(?:rate|price|tariff|тариф|цен|preis)|(?:rate|price|tariff|тариф|цен|preis).*(?:recommend|suggest|analy[sz]e|advice|совет|рекоменд|анализ|подскаж|empfehl|analysier)|(?:when|когда|wann).*(?:rais|lower|increas|decreas|поднять|повыс|сниз|уменьш|erhöh|senk).*(?:rate|price|тариф|цен|preis)/i;

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
  rateResult?: RateRecommendationResult;
}

interface AdminAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  rateResult: RateRecommendationResult | null;
  onRefreshRates: () => Promise<RateRecommendationResult>;
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
export function AdminAssistantPanel({ open, onClose, triggerRef, rateResult, onRefreshRates }: AdminAssistantPanelProps) {
  const router = useRouter();
  const locale = useAdminLocale();
  const t = useAdminT();
  const [mounted, setMounted] = React.useState(false);
  const { rendered, visible } = useOverlayTransition(open);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState<AdminDraft | null>(null);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [servicePhotos, setServicePhotos] = React.useState<string[]>([]);
  const addOnField = draft?.kind === 'create_add_on' ? addOnDraftFields.find((field) => draft.fields[field] === null) : null;
  const photosStep = addOnField === 'photos';
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const threadRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => window.clearTimeout(timer);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      // A child modal (such as the photo library) owns outside clicks while open.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose, triggerRef]);

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

  async function send(utterance: string, displayText = utterance) {
    const text = utterance.trim();
    if (!text || busy || uploading) return;
    setInput('');
    push({ role: 'admin', text: displayText.trim() });
    setBusy(true);

    if (!draft && RATE_ADVICE_PATTERN.test(text)) {
      const result = await onRefreshRates();
      setBusy(false);
      push({ role: 'assistant', text: t(result.status === 'unavailable' ? 'assistant.rate.unavailable' : result.recommendations.length ? 'assistant.rate.found' : 'assistant.rate.none'),
        ...(result.status === 'ready' && result.recommendations.length ? { rateResult: result } : {}),
      });
      return;
    }

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

    receive(response, text);
  }

  function receive(response: Extract<AdminAskResponse, { ok: true }>, text: string) {
    const { result } = response;
    if (result.outcome === 'question' && result.draft.kind === 'create_add_on' && draft?.kind !== 'create_add_on') setServicePhotos([]);
    setDraft(result.outcome === 'question' ? result.draft : null);
    push({
      role: 'assistant',
      text: formatAdminAssistantReply(result, locale),
      ...(result.outcome === 'ambiguous' ? { candidates: result.candidates, answering: { utterance: text, target: result.target } } : {}),
      ...(result.outcome === 'proposal' ? { proposal: result.proposal, proposalState: 'pending' as const } : {}),
      note: noteFor(result, response.interpretedBy),
    });
  }

  async function continueWithPhotos(photos: string[]) {
    if (draft?.kind !== 'create_add_on' || busy || uploading) return;
    setBusy(true);
    try {
      const response = await reviewAssistantAddOnAction({ ...draft.fields, photos });
      if (!response.ok) throw new Error('Unable to review photos');
      push({ role: 'admin', text: t('assistant.photos.selected', { count: photos.length }) });
      receive(response, '');
    } catch {
      push({ role: 'assistant', text: t('assistant.error.unreachable') });
    } finally { setBusy(false); }
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
    let result;
    try { result = await applyAdminProposalAction(proposal); }
    catch {
      push({ role: 'assistant', text: t('assistant.error.unreachable') });
      return;
    } finally { setBusy(false); }
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
      ref={panelRef}
      role="dialog"
      aria-label={t('assistant.title')}
      className={cn(
        styles.panel,
        'fixed z-40 flex flex-col overflow-hidden rounded-[18px] outline-none transition-[opacity,translate,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
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
          {messages.length === 0 && rateResult?.status === 'ready' && rateResult.recommendations.length > 0 ? <RateRecommendationsCard result={rateResult} /> : null}
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
              <button type="button" disabled={busy} onClick={() => void send('recommend room rates', t('assistant.rate.check'))} className={pill('secondary', 'min-h-10 px-3 text-xs font-medium')}>
                {t('assistant.rate.check')}
              </button>
            </>
          ) : null}

          {messages.map((message) => (
            <React.Fragment key={message.id}>
              <Bubble role={message.role}>{message.text}</Bubble>
              {message.rateResult?.status === 'ready' && message.rateResult.recommendations.length > 0 ? <RateRecommendationsCard result={message.rateResult} /> : null}

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
          {photosStep ? <ServicePhotosStep busy={busy || uploading} initial={servicePhotos} onChange={setServicePhotos} onBusyChange={setUploading} onContinue={(photos) => void continueWithPhotos(photos)} /> : null}
          {addOnField === 'category' ? <div className="flex flex-wrap gap-2">
            {(['service', 'dining'] as const).map((category) => <button key={category} type="button" disabled={busy} className={pill('secondary', 'min-h-9 text-xs')} onClick={() => void send(category, lAddOnCategory(category, locale))}>{lAddOnCategory(category, locale)}</button>)}
          </div> : null}
          {addOnField === 'pricingUnit' ? <div className="flex flex-wrap gap-2">
            {(['per_stay', 'per_night', 'per_guest'] as const).map((unit) => <button key={unit} type="button" disabled={busy} className={pill('secondary', 'min-h-9 text-xs')} onClick={() => void send(unit.replace('_', ' '), lPricingUnit(unit, locale))}>{lPricingUnit(unit, locale)}</button>)}
          </div> : null}
          {addOnField === 'enabled' ? <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={pill('primary', 'min-h-9 text-xs')} onClick={() => void send('on sale', t('assistant.service.onSale'))}>{t('assistant.service.onSale')}</button>
            <button type="button" disabled={busy} className={pill('secondary', 'min-h-9 text-xs')} onClick={() => void send('hidden', t('assistant.service.hidden'))}>{t('assistant.service.hidden')}</button>
          </div> : null}
          {draft ? <button type="button" disabled={busy || uploading} className="justify-self-start px-2 py-1 text-xs text-muted-foreground underline underline-offset-2" onClick={() => void send('cancel', t('assistant.notThat'))}>{t('assistant.notThat')}</button> : null}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-border/60 p-2.5"
      >
        <textarea
          ref={inputRef}
          rows={addOnField === 'description' ? 3 : 1}
          value={input}
          onChange={(event) => setInput(event.target.value.slice(0, MAX_UTTERANCE_LENGTH))}
          placeholder={draft ? t('assistant.answerPlaceholder') : t('assistant.placeholder')}
          aria-label={t('assistant.inputLabel')}
          maxLength={MAX_UTTERANCE_LENGTH}
          disabled={uploading || photosStep}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!photosStep) void send(input);
            }
          }}
          className={cn(fieldClass, 'min-h-11 resize-none py-2.5 text-sm leading-5', addOnField === 'description' && 'rounded-2xl')}
        />
        <button type="submit" aria-label={t('assistant.send')} disabled={busy || uploading || photosStep || !input.trim()} className={iconButton('dark', 'size-10')}>
          {busy ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : <PaperAirplaneIcon className="size-4" aria-hidden="true" />}
        </button>
      </form>
    </div>,
    document.body,
  );
}

function RateRecommendationsCard({ result }: { result: Extract<RateRecommendationResult, { status: 'ready' }> }) {
  const locale = useAdminLocale();
  const t = useAdminT();
  const router = useRouter();
  return (
    <div className="rounded-[18px] border border-border bg-card p-3.5">
      <p className="text-sm font-medium">{t('assistant.rate.heading')}</p>
      <ul className="mt-2 divide-y divide-border border-t border-border">
        {result.recommendations.map((suggestion) => (
          <li key={suggestion.id} className="py-3 text-sm">
            <p className="font-medium">{t('assistant.rate.event', {
              event: suggestion.event === 'holiday' ? suggestion.holidayName ?? '' : t('assistant.rate.weekend'),
              date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${suggestion.date}T12:00:00Z`)),
            })}</p>
            <p className="mt-1">{t(suggestion.direction === 'increase' ? 'assistant.rate.increase' : 'assistant.rate.decrease', {
              room: suggestion.roomName, booked: suggestion.booked, capacity: suggestion.capacity,
            })}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('assistant.rate.price', {
              rate: suggestion.rateName,
              current: lMoney(suggestion.currentPrice, result.currency, locale),
              suggested: lMoney(suggestion.suggestedPrice, result.currency, locale),
            })} <span className="font-semibold text-accent-strong">({suggestion.changePercent > 0 ? '+' : ''}{suggestion.changePercent}%)</span></p>
            {suggestion.baselinePercent !== null ? <p className="mt-1 text-xs text-muted-foreground">{t('assistant.rate.baseline', { percent: suggestion.baselinePercent })}</p> : null}
            <button type="button" onClick={() => router.push(suggestion.href)} className={pill('primary', 'mt-2 min-h-10 px-4 text-xs')}>
              {t('assistant.rate.openDate')}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('assistant.rate.method')}</p>
    </div>
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
      {proposal.kind === 'create_add_on' ? <>
        <p className="mt-2 whitespace-pre-wrap text-sm">{proposal.input.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t('assistant.photos.selected', { count: proposal.input.photos.length })} · {t(proposal.input.enabled ? 'assistant.service.onSale' : 'assistant.service.hidden')}</p>
        {proposal.input.photos.length ? <div className="mt-2 flex gap-2 overflow-x-auto">
          {proposal.input.photos.map((url, index) => <img key={url} src={url} alt={index === 0 ? t('media.cover') : ''} className="admin-grid-photo" />)}
        </div> : null}
      </> : null}
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
