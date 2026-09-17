'use client';

import * as React from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

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

export function Toaster() {
  const current = React.useSyncExternalStore(
    subscribe,
    () => items,
    () => empty,
  );

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-20 sm:top-auto sm:bottom-0 sm:items-end sm:p-6"
    >
      {current.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-card py-3 pr-2 pl-4 text-sm shadow-soft-lg animate-in fade-in sm:slide-in-from-bottom-2',
            item.tone === 'error' ? 'border-danger/30' : 'border-border',
          )}
        >
          {item.tone === 'error' ? (
            <WarningCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
          ) : (
            <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1 py-0.5 font-medium">{item.message}</p>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-stone hover:text-foreground"
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
