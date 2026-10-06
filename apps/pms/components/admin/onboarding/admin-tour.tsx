'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Popover } from '@base-ui/react/popover';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, pill } from '@/lib/ui';
import { TOUR_START_EVENT, TOUR_STEPS, TOUR_STORAGE_KEY, type TourStep } from './tour-steps';

/** How far the ring sits outside whatever it is pointing at. */
const RING_PAD = 6;
/** One beat for the shell to lay itself out before anything is measured. */
const START_DELAY = 700;

// localStorage can throw — private window, blocked site data, a cross-origin
// iframe. A tour that cannot remember it was seen should play again, not
// crash the back office. Same rationale as `notification-bell.tsx`.
function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    // Not remembered — it plays again next time, which is the harmless way to fail.
  }
}

/**
 * The first target that is actually on screen — not merely the first in the
 * document. The bell and the brand are rendered twice, once in the sidebar
 * and once in the phone's top bar, and only one of the two has boxes at any
 * width; a plain `querySelector` would keep finding the hidden one.
 */
function targetOf(step: TourStep): HTMLElement | null {
  const candidates = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)];
  return candidates.find((element) => element.getClientRects().length > 0) ?? null;
}

/** The hole follows the target's own corners, so a round button gets a round hole. */
function holeRadius(element: HTMLElement, height: number): number {
  const raw = window.getComputedStyle(element).borderRadius.split(' ')[0] ?? '';
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 18;
  // A pill's `9999px` is not a real radius — it means "as round as it goes".
  return value > 100 ? height / 2 : value + RING_PAD;
}

/**
 * The dimmed sheet with the target punched out of it, as one `clip-path`:
 * the viewport rectangle and the target's own rounded rectangle, wound
 * `evenodd` so the second cuts a hole in the first.
 *
 * A `box-shadow` spread would be less code and is the usual trick, but CSS
 * grows the corner radius by the spread — at the spread needed to cover a
 * screen, the "straight" edges bow into a visible arc across the page.
 */
function cutout(rect: DOMRect, radius: number, pad: number): string {
  const x = rect.left - pad;
  const y = rect.top - pad;
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const hole =
    `M${x + r} ${y} H${x + width - r} A${r} ${r} 0 0 1 ${x + width} ${y + r}` +
    ` V${y + height - r} A${r} ${r} 0 0 1 ${x + width - r} ${y + height}` +
    ` H${x + r} A${r} ${r} 0 0 1 ${x} ${y + height - r}` +
    ` V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  return `path(evenodd, "M0 0 H${window.innerWidth} V${window.innerHeight} H0 Z ${hole}")`;
}

/**
 * The hints a team member meets the first time the back office opens: one
 * card at a time, pointing at the thing it describes, with everything else
 * dimmed — the shape every product tour has settled on.
 *
 * Mounted once in `AdminShell`, so the steps can point at the shell's own
 * furniture from whichever screen the admin happened to land on. Which steps
 * play is decided from what is actually on screen (see `tour-steps.ts`), and
 * "seen" is remembered in this browser rather than server side, because
 * there is no per-user session yet — the same documented gap the
 * notification bell lives with (CLAUDE.md: auth is future work).
 */
export function AdminTour() {
  const t = useAdminT();
  const [mounted, setMounted] = React.useState(false);
  const [steps, setSteps] = React.useState<TourStep[]>([]);
  const [index, setIndex] = React.useState(0);
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => setMounted(true), []);

  const start = React.useCallback(() => {
    const playable = TOUR_STEPS.filter((step) => targetOf(step) !== null);
    if (playable.length === 0) return;
    setIndex(0);
    setSteps(playable);
  }, []);

  const finish = React.useCallback(() => {
    setSteps([]);
    setIndex(0);
    remember();
  }, []);

  // First run, plus the replay from `/admin/account` — one listener either way.
  React.useEffect(() => {
    window.addEventListener(TOUR_START_EVENT, start);
    const timer = alreadySeen() ? null : window.setTimeout(start, START_DELAY);
    return () => {
      window.removeEventListener(TOUR_START_EVENT, start);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [start]);

  const step = steps[index] ?? null;

  // The ring is drawn in viewport coordinates, so it has to be re-measured
  // whenever anything moves: a scroll (in any scroller, hence the capture
  // phase), a resize, or the target growing a badge of its own.
  React.useEffect(() => {
    if (!step) {
      setAnchor(null);
      setRect(null);
      return;
    }

    const element = targetOf(step);
    setAnchor(element);
    if (!element) {
      setRect(null);
      return;
    }

    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const measure = () => setRect(element.getBoundingClientRect());
    measure();

    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [step]);

  React.useEffect(() => {
    if (!step) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step, finish]);

  if (!mounted || !step) return null;

  const last = index === steps.length - 1;
  const radius = anchor && rect ? holeRadius(anchor, rect.height + RING_PAD * 2) : null;

  return (
    <>
      {createPortal(
        <>
          {/* Also the click blocker: the tour drives itself, and a stray click
              on a half-explained screen is how a tour loses its place. */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[70] bg-ink/55"
            style={rect && radius !== null ? { clipPath: cutout(rect, radius, RING_PAD) } : undefined}
          />
          {rect ? (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[71] ring-2 ring-accent"
              style={{
                top: rect.top - RING_PAD,
                left: rect.left - RING_PAD,
                width: rect.width + RING_PAD * 2,
                height: rect.height + RING_PAD * 2,
                borderRadius: radius === null ? 18 : radius,
              }}
            />
          ) : null}
        </>,
        document.body,
      )}

      <Popover.Root open modal={false}>
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchor}
            side={step.side}
            align="center"
            sideOffset={14}
            collisionPadding={16}
            className="z-[80] outline-none"
          >
            <Popover.Popup className="w-[min(21rem,calc(100vw-2rem))] rounded-[18px] border border-border bg-card p-5 text-foreground shadow-soft-lg outline-none">
              <div className="flex items-start justify-between gap-3">
                <Popover.Title className="text-display text-lg">{t(step.title)}</Popover.Title>
                <button
                  type="button"
                  onClick={finish}
                  aria-label={t('tour.close')}
                  className={iconButton('light', '-mt-1 -mr-1 size-8')}
                >
                  <XMarkIcon className="size-4" aria-hidden="true" />
                </button>
              </div>

              <Popover.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(step.body)}
              </Popover.Description>

              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t('tour.step', { current: index + 1, total: steps.length })}
                </span>
                <div className="flex items-center gap-2">
                  {index > 0 ? (
                    <button type="button" onClick={() => setIndex((current) => current - 1)} className={pill('secondary', 'min-h-9 px-4 text-xs')}>
                      {t('tour.back')}
                    </button>
                  ) : (
                    <button type="button" onClick={finish} className={pill('ghost', 'min-h-9 px-3 text-xs')}>
                      {t('tour.skip')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (last ? finish() : setIndex((current) => current + 1))}
                    className={pill('primary', 'min-h-9 px-4 text-xs')}
                  >
                    {last ? t('tour.done') : t('tour.next')}
                  </button>
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
