'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useAdminT } from '@/lib/i18n/admin/context';
import { rateRecommendationsAction } from '@/app/admin/assistant/actions';
import { todayRateIncrease, type RateRecommendationResult } from '@/lib/application/rate-recommendations';
import { useAdminLocale } from '@/lib/i18n/admin/context';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { pill } from '@/lib/ui';
import { AdminAssistantPanel } from './admin-assistant-panel';
import { AssistantLauncherVisual } from '@/components/assistant/assistant-launcher-visual';
import { toast } from '@/components/admin/shell/toast';

/**
 * The admin's way into its assistant — the same interactive orb as the
 * guest's (`components/assistant/assistant-launcher.tsx`),
 * so the two read as one feature across both sides of the product. Mounted
 * once, in `AdminShell`, so it is on every back-office screen. Unlike the
 * guest's, it stays put while the chat is open and toggles it: the chat is
 * a window beside the page, not a dialog over it.
 *
 * Lifted below `lg` to clear the CMS forms' docked save bar (`ContentForm`
 * with `dock`, `fixed inset-x-0 bottom-0`), the way the guest launcher
 * lifts above the book bar on a room page.
 *
 * Not on `/admin/communications`: that screen is a chat of its own, its
 * reply box docked in the same corner, and the orb would sit on the send
 * button.
 */
export function AdminAssistantLauncher() {
  const [open, setOpen] = React.useState(false);
  const [rateResult, setRateResult] = React.useState<RateRecommendationResult | null>(null);
  const [promptVisible, setPromptVisible] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const t = useAdminT();
  const locale = useAdminLocale();
  const pathname = usePathname() ?? '';
  const refresh = React.useCallback(async () => {
    const result = await rateRecommendationsAction().catch(() => ({ status: 'unavailable' as const }));
    setRateResult(result);
    return result;
  }, []);
  React.useEffect(() => {
    let active = true;
    void rateRecommendationsAction().then((result) => {
      if (!active) return;
      setRateResult(result);
      const first = result.status === 'ready' ? result.recommendations[0] : null;
      if (!first || pathname.startsWith('/admin/rates') || pathname.startsWith('/admin/communications')) return;
      const todayIncrease = todayRateIncrease(result);
      if (todayIncrease) {
        const toastKey = `rate-today-toast:${todayIncrease.id}`;
        if (!window.sessionStorage.getItem(toastKey)) {
          window.sessionStorage.setItem(toastKey, 'shown');
          toast.advice(t('assistant.rate.todayToast', {
            event: todayIncrease.event === 'holiday' ? todayIncrease.holidayName ?? '' : t('assistant.rate.weekendToday'),
            room: todayIncrease.roomName,
            booked: todayIncrease.booked,
            capacity: todayIncrease.capacity,
          }), todayIncrease.href, t('assistant.rate.openDate'));
        }
        return;
      }
      const key = `rate-recommendation:${first.id}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, 'shown');
      setPromptVisible(true);
    }).catch(() => { if (active) setRateResult({ status: 'unavailable' }); });
    return () => { active = false; };
  }, [pathname, t]);
  React.useEffect(() => {
    if (!promptVisible) return;
    const timer = window.setTimeout(() => setPromptVisible(false), 9000);
    return () => window.clearTimeout(timer);
  }, [promptVisible]);
  if (pathname.startsWith('/admin/communications')) return null;

  const firstSuggestion = rateResult?.status === 'ready' ? rateResult.recommendations[0] : null;
  const eventDate = firstSuggestion ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${firstSuggestion.date}T12:00:00Z`)) : '';

  return (
    <>
      {firstSuggestion && promptVisible && !open && !pathname.startsWith('/admin/rates') ? (
        <div role="status" className="fixed right-3 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-40 w-[min(21rem,calc(100vw-1.5rem))] rounded-[18px] border border-border bg-card p-4 shadow-soft sm:right-6 lg:bottom-[6.5rem]">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm font-medium leading-snug">{t('assistant.rate.event', { event: firstSuggestion.event === 'holiday' ? firstSuggestion.holidayName ?? '' : t('assistant.rate.weekend'), date: eventDate })}</p>
            <button type="button" onClick={() => setPromptVisible(false)} aria-label={t('assistant.holiday.dismiss')} className="grid size-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent">
              <XMarkIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-sm">{t(firstSuggestion.direction === 'increase' ? 'assistant.rate.increase' : 'assistant.rate.decrease', {
            room: firstSuggestion.roomName, booked: firstSuggestion.booked, capacity: firstSuggestion.capacity,
          })}</p>
          <button type="button" onClick={() => { setPromptVisible(false); setOpen(true); }} className={pill('primary', 'mt-3 min-h-10 px-4 text-xs')}>
            {t('assistant.rate.review')}
          </button>
        </div>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        data-tour="assistant"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t('assistant.close') : t('assistant.title')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'fixed right-3 z-40 flex size-16 scale-100 cursor-pointer items-center justify-center rounded-full bg-transparent p-2 outline-none transition-[scale] duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:right-6 lg:bottom-6',
        )}
      >
        <AssistantLauncherVisual id="admin-assistant-orb" open={open} />
      </button>

      <AdminAssistantPanel open={open} onClose={close} triggerRef={triggerRef} rateResult={rateResult} onRefreshRates={refresh} />
    </>
  );
}
