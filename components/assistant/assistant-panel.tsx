'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  MicrophoneIcon,
  PaperAirplaneIcon,
  StopCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { AssistantAskResult } from '@/lib/application/assistant-service';
import { defaultRoomFilters, type RoomFilters } from '@/lib/application/catalog-service';
import {
  defaultCriteria,
  parseCriteria,
  parseFilters,
  type SearchParamsInput,
} from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';
import { formatAssistantSummary, formatDateRange } from '@/lib/formatting';
import { iconButton, fieldClass, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { RoomCard } from '@/components/rooms/room-card';
import { OVERLAY_TRANSITION_MS, useOverlayTransition } from '@/components/site/use-overlay-transition';
import { ThinkingOrbs, type AssistantPhase } from './thinking-orbs';
import { useVoiceCapture } from './use-voice-capture';

type AssistantSearchResponse = AssistantAskResult & { interpretedBy: 'openai' | 'keyword' | null };

const EXAMPLE_UTTERANCES = [
  'A sea view suite for two',
  'Something with a balcony, under €300',
  'A quiet garden room next weekend',
];

const PHASE_LABEL: Partial<Record<AssistantPhase, string>> = {
  idle: 'Tell me what you are looking for, or use the mic.',
  listening: 'Listening — tap the mic again to stop.',
  transcribing: 'Turning that into text…',
  thinking: 'Searching the catalog…',
  'mic-denied': 'Microphone access is unavailable here — you can still type.',
};

/** `URLSearchParams` → the record shape `parseCriteria`/`parseFilters` read, multi-values kept. */
function toParamsInput(params: URLSearchParams): SearchParamsInput {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
  /** Matches the launcher's own lift on `/rooms/[slug]` below `lg`, so the anchored panel still sits above it. */
  mobileOffset?: 'default' | 'above-book-bar';
}

export function AssistantPanel({ open, onClose, mobileOffset = 'default' }: AssistantPanelProps) {
  const searchParams = useSearchParams();
  const { rendered, visible } = useOverlayTransition(open);
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [baseCriteria, setBaseCriteria] = React.useState<StayCriteria>(() => defaultCriteria());
  const [baseFilters, setBaseFilters] = React.useState<RoomFilters>(defaultRoomFilters);
  const [criteria, setCriteria] = React.useState<StayCriteria>(baseCriteria);
  const [filters, setFilters] = React.useState<RoomFilters>(baseFilters);

  const [inputValue, setInputValue] = React.useState('');
  const [phase, setPhase] = React.useState<AssistantPhase>('idle');
  const [result, setResult] = React.useState<AssistantSearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [micHidden, setMicHidden] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Fresh each time the panel opens: the guest's stay may have moved on since it last closed.
  React.useEffect(() => {
    if (!open) return;
    const input = toParamsInput(new URLSearchParams(searchParams.toString()));
    const nextCriteria = parseCriteria(input);
    const nextFilters = parseFilters(input);
    setBaseCriteria(nextCriteria);
    setBaseFilters(nextFilters);
    setCriteria(nextCriteria);
    setFilters(nextFilters);
    setInputValue('');
    setResult(null);
    setErrorMessage(null);
    setPhase('idle');
  }, [open, searchParams]);

  const voice = useVoiceCapture({
    onTranscript: (text) => {
      setInputValue(text);
      setPhase('idle');
      inputRef.current?.focus();
    },
    onError: (message) => {
      setErrorMessage(message);
      setPhase('error');
    },
  });

  React.useEffect(() => {
    if (voice.status === 'listening') setPhase('listening');
    else if (voice.status === 'transcribing') setPhase('transcribing');
    else if (voice.status === 'denied' || voice.status === 'unsupported') {
      setMicHidden(true);
      setPhase('mic-denied');
    }
  }, [voice.status]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), OVERLAY_TRANSITION_MS);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  React.useEffect(() => {
    if (!rendered) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [rendered]);

  const runSearch = React.useCallback(
    async (utterance: string, filtersOverride?: RoomFilters, criteriaOverride?: StayCriteria) => {
      const effectiveCriteria = criteriaOverride ?? criteria;
      const effectiveFilters = filtersOverride ?? filters;
      setErrorMessage(null);
      setPhase('thinking');
      try {
        const response = await fetch('/api/assistant/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            utterance,
            checkIn: effectiveCriteria.checkIn,
            checkOut: effectiveCriteria.checkOut,
            adults: effectiveCriteria.adults,
            children: effectiveCriteria.children,
            minPrice: effectiveFilters.minPrice ?? undefined,
            maxPrice: effectiveFilters.maxPrice ?? undefined,
            views: effectiveFilters.views.length ? effectiveFilters.views : undefined,
            bedTypes: effectiveFilters.bedTypes.length ? effectiveFilters.bedTypes : undefined,
            categories: effectiveFilters.categories.length ? effectiveFilters.categories : undefined,
            amenities: effectiveFilters.amenities.length ? effectiveFilters.amenities : undefined,
          }),
        });
        const payload = (await response.json().catch(() => null)) as
          | AssistantSearchResponse
          | { message?: unknown }
          | null;

        if (!response.ok) {
          const message = payload && 'message' in payload ? payload.message : undefined;
          setErrorMessage(
            (typeof message === 'string' && message) ||
              (response.status === 429
                ? 'Too many searches at once. Wait a moment and try again.'
                : 'Could not run that search.'),
          );
          setPhase('error');
          return;
        }

        const data = payload as AssistantSearchResponse;
        setResult(data);
        setCriteria(data.criteria);
        setFilters(data.filters);
        setPhase(data.offers.length > 0 ? 'results' : 'empty');
      } catch {
        setErrorMessage('Could not reach the assistant. Check your connection and try again.');
        setPhase('error');
      }
    },
    [criteria, filters],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const utterance = inputValue.trim();
    if (!utterance) return;
    void runSearch(utterance);
  };

  const removeChip = (next: RoomFilters, nextCriteria?: StayCriteria) => {
    setFilters(next);
    if (nextCriteria) setCriteria(nextCriteria);
    void runSearch('', next, nextCriteria);
  };

  const chips: FilterChip[] = [
    ...(criteria.checkIn !== baseCriteria.checkIn || criteria.checkOut !== baseCriteria.checkOut
      ? [
          {
            key: 'dates',
            label: formatDateRange(criteria.checkIn, criteria.checkOut),
            onRemove: () => removeChip(filters, baseCriteria),
          },
        ]
      : []),
    ...filters.views.map((view) => ({
      key: `view-${view}`,
      label: `${view[0].toUpperCase()}${view.slice(1)} view`,
      onRemove: () => removeChip({ ...filters, views: filters.views.filter((v) => v !== view) }),
    })),
    ...filters.bedTypes.map((bed) => ({
      key: `bed-${bed}`,
      label: `${bed[0].toUpperCase()}${bed.slice(1)} bed`,
      onRemove: () => removeChip({ ...filters, bedTypes: filters.bedTypes.filter((b) => b !== bed) }),
    })),
    ...filters.categories.map((category) => ({
      key: `category-${category}`,
      label: `${category[0].toUpperCase()}${category.slice(1)}`,
      onRemove: () => removeChip({ ...filters, categories: filters.categories.filter((c) => c !== category) }),
    })),
    ...filters.amenities.map((amenity) => ({
      key: `amenity-${amenity}`,
      label: amenity,
      onRemove: () => removeChip({ ...filters, amenities: filters.amenities.filter((a) => a !== amenity) }),
    })),
    ...(filters.minPrice !== null || filters.maxPrice !== null
      ? [
          {
            key: 'price',
            label:
              filters.maxPrice !== null && filters.minPrice !== null
                ? `€${filters.minPrice}–€${filters.maxPrice}`
                : filters.maxPrice !== null
                  ? `Under €${filters.maxPrice}`
                  : `Over €${filters.minPrice}`,
            onRemove: () => removeChip({ ...filters, minPrice: null, maxPrice: null }),
          },
        ]
      : []),
  ];

  const summary = result
    ? formatAssistantSummary({
        matchedRooms: result.offers.length,
        totalRooms: result.totalRooms,
        filters,
        criteria,
        currency: result.offers[0]?.price.currency ?? 'EUR',
        fromNightly: result.offers.length
          ? Math.min(...result.offers.map((offer) => offer.price.nightlyPrice))
          : null,
      })
    : '';

  if (!rendered || !mounted) return null;

  const statusLabel =
    phase === 'results'
      ? summary
      : phase === 'empty'
        ? `No rooms match that combination for ${formatDateRange(criteria.checkIn, criteria.checkOut)}.`
        : phase === 'error'
          ? (errorMessage ?? 'Something went wrong.')
          : (PHASE_LABEL[phase] ?? '');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'absolute inset-0 cursor-default bg-ink/40 backdrop-blur-md transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find a room by voice or description"
        tabIndex={-1}
        style={{ transformOrigin: 'bottom center' }}
        className={cn(
          // `will-change` because the panel is frosted: without a layer of its
          // own the browser re-runs the backdrop blur against the page on every
          // frame of the open, and the arrival comes in steps.
          'glass relative flex w-full flex-col overflow-hidden rounded-[28px] shadow-soft-lg outline-none transition-[opacity,translate,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
          // Tall enough that a full result — summary, chips, four cards and the
          // handoff link — lands without an inner scroll, and still bounded by
          // the window so a short desktop one does not push the CTA off.
          'max-h-[85dvh] sm:max-h-[min(37rem,85dvh)] sm:max-w-3xl',
          mobileOffset === 'above-book-bar' ? 'sm:mb-[9.5rem] lg:mb-10' : 'sm:mb-10',
          visible
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-4 opacity-0 sm:translate-y-0 sm:scale-[0.98]',
        )}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <div className="size-16 shrink-0 rounded-full bg-stone">
            <ThinkingOrbs phase={phase} getAmplitude={voice.getAmplitude} />
          </div>
          <p className="flex-1 text-base font-medium">AI room finder</p>
          <button type="button" onClick={onClose} aria-label="Close" className={iconButton('light', 'size-9')}>
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <p role="status" aria-live="polite" className="text-base leading-relaxed text-foreground">
            {statusLabel}
          </p>

          {phase === 'results' && result?.interpretedBy === 'keyword' ? (
            <p className="mt-1.5 text-xs text-muted-foreground">Matching on keywords — no AI key is configured for this demo.</p>
          ) : null}

          {chips.length > 0 && (phase === 'results' || phase === 'empty') ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button type="button" onClick={chip.onRemove} className={cn(tag(), 'gap-1 pr-2')}>
                    {chip.label}
                    <XMarkIcon className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {phase === 'results' && result ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {result.offers.slice(0, 4).map((offer) => (
                <RoomCard key={offer.room.id} offer={offer} stayQuery={result.query} layout="tile" />
              ))}
            </div>
          ) : null}

          {phase === 'results' && result ? (
            <Link href={`/rooms?${result.query}`} className={pill('primary', 'mt-4 w-full')}>
              See all {result.totalRooms} rooms
            </Link>
          ) : null}

          {phase === 'results' && result && result.unresolved.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              I ignored &ldquo;{result.unresolved.join('", "')}&rdquo; — the catalog has no filter for{' '}
              {result.unresolved.length === 1 ? 'it' : 'them'}.
            </p>
          ) : null}

          {phase === 'empty' && result?.relaxation ? (
            <button
              type="button"
              onClick={() => void runSearch('', result.relaxation!.filters)}
              className={pill('secondary', 'mt-4')}
            >
              {result.relaxation.label}
            </button>
          ) : null}

          {phase === 'error' ? (
            <button type="button" onClick={() => void runSearch(inputValue.trim())} className={pill('secondary', 'mt-4')}>
              Try again
            </button>
          ) : null}

          {phase === 'idle' && !result ? (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {EXAMPLE_UTTERANCES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue(example);
                      inputRef.current?.focus();
                    }}
                    className={tag('cursor-pointer hover:bg-border')}
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border/60 p-3">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value.slice(0, 400))}
            placeholder="A quiet sea-view suite for two, under €400…"
            aria-label="Describe the room you want"
            maxLength={400}
            disabled={phase === 'listening' || phase === 'transcribing'}
            className={fieldClass}
          />

          {!micHidden ? (
            <button
              type="button"
              onClick={() => {
                if (voice.status === 'listening') voice.stop();
                else {
                  voice.reset();
                  void voice.start();
                }
              }}
              aria-label={voice.status === 'listening' ? 'Stop recording' : 'Speak your search'}
              className={iconButton(voice.status === 'listening' ? 'dark' : 'light')}
            >
              {voice.status === 'listening' ? (
                <StopCircleIcon className="size-5" aria-hidden="true" />
              ) : (
                <MicrophoneIcon className="size-5" aria-hidden="true" />
              )}
            </button>
          ) : null}

          <button
            type="submit"
            aria-label="Search"
            disabled={!inputValue.trim() || phase === 'listening' || phase === 'transcribing' || phase === 'thinking'}
            className={iconButton('dark')}
          >
            <PaperAirplaneIcon className="size-4" aria-hidden="true" />
          </button>
        </form>

        {phase === 'listening' ? (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
            <span>{voice.countdown !== null ? `Auto-stop in ${voice.countdown}s` : 'Listening…'}</span>
            <button type="button" onClick={() => voice.cancel()} className="cursor-pointer font-medium text-foreground">
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
