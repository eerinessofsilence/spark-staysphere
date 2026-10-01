'use client';

import * as React from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { ArrowPathIcon, ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';
import { pill } from '@/lib/ui';
import { DELETE_UNDO_MS, deletionQueue, type PendingDeletion } from './deletion-queue';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

/**
 * One small store for the whole back office, so any client component can
 * report the outcome of an action without threading a context through the
 * tree. The `Toaster` lives in the admin shell, which survives navigation —
 * a save that redirects still shows its toast on the page it lands on. On a
 * phone they drop in under the header, clear of the docked save bar.
 */
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, message: string) {
  if (!message.trim()) return;
  const id = nextId++;
  // One at a time per message: a double submit shouldn't stack identical toasts.
  items = [...items.filter((item) => item.message !== message), { id, tone, message }].slice(-3);
  timers.set(id, setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000));
  emit();
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const empty: ToastItem[] = [];

// A consistently dark surface keeps notifications distinct from the page in either theme.
const toastSurface =
  'pointer-events-auto flex w-full max-w-md shrink-0 gap-3 rounded-2xl border border-white/20 bg-ink/90 text-white shadow-soft-lg backdrop-blur-xl backdrop-saturate-150 animate-in fade-in';

export function Toaster() {
  const deletions = React.useSyncExternalStore(deletionQueue.subscribe, deletionQueue.getSnapshot, () => emptyDeletions);
  const current = React.useSyncExternalStore(
    subscribe,
    () => items,
    () => empty,
  );
  const t = useAdminT();
  React.useEffect(() => {
    const cancel = () => deletionQueue.cancelWaiting();
    window.addEventListener('pagehide', cancel);
    return () => window.removeEventListener('pagehide', cancel);
  }, []);

  return (
    <div
      aria-label={t('toast.region')}
      // Past `lg` the stack sits above the assistant launcher's corner, not on it.
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-20 sm:top-auto sm:bottom-0 sm:items-end sm:p-6 lg:pb-28"
    >
      <div className="flex max-h-[45dvh] w-full flex-col items-center gap-3 overflow-y-auto p-1 sm:items-end">
        {deletions.map((item) => <DeletionToast key={item.key} item={item} />)}
        {current.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              toastSurface,
              'items-center py-3 pr-2 pl-4 text-sm sm:slide-in-from-bottom-2',
              item.tone === 'error' && 'border-danger',
            )}
          >
            {item.tone === 'error' ? (
              <WarningCircle weight="fill" className="size-6 shrink-0 text-white" aria-hidden="true" />
            ) : (
              <CheckCircle weight="fill" className="size-6 shrink-0 text-white" aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 py-0.5 font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={t('toast.dismiss')}
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <XMarkIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const emptyDeletions: PendingDeletion[] = [];

function DeletionToast({ item }: { item: PendingDeletion }) {
  const t = useAdminT();
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, item.deadline - now);
  const deleting = item.phase === 'deleting' || remaining === 0;

  return (
    <div data-deletion-toast className={cn(toastSurface, 'items-center p-4 text-sm')}>
      <span aria-hidden="true" className="relative grid size-10 shrink-0 place-items-center font-semibold tabular-nums">
        {deleting ? <ArrowPathIcon className="size-5 animate-spin" /> : (
          <>
            <svg viewBox="0 0 40 40" className="absolute inset-0 size-10 -rotate-90 fill-none" aria-hidden="true">
              <circle cx="20" cy="20" r="17" className="stroke-white/20" strokeWidth="3" />
              <circle cx="20" cy="20" r="17" className="stroke-white" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - remaining / DELETE_UNDO_MS} strokeLinecap="round" />
            </svg>
            {Math.ceil(remaining / 1000)}
          </>
        )}
      </span>
      <div role="status" className="min-w-0 flex-1 break-words">
        <p className="font-medium">{t('toast.deleting', { label: item.label })}</p>
        <p className="mt-1 text-xs text-white/75">{deleting ? t('toast.finishingDelete') : t('toast.undoHint')}</p>
      </div>
      <button
        type="button"
        disabled={deleting}
        className={pill('onPhoto', 'min-h-11 shrink-0 gap-1.5 px-3 focus-visible:outline-white')}
        onClick={() => {
          if (deletionQueue.undo(item.key)) toast.success(t('toast.deleteCancelled'));
        }}
      >
        <ArrowUturnLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        {t('toast.undo')}
      </button>
    </div>
  );
}
