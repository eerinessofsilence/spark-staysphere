'use client';

import Link from 'next/link';
import { CheckCircle, Sparkle, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { pill } from '@/lib/ui';

/** Shared guest/admin notification; labels come from the caller's locale. */
export function NotificationToast({ message, tone = 'success', href, actionLabel, actionButton = false, actionNewTab = false, dismissLabel, onDismiss, onActivate }: {
  message: string;
  tone?: 'success' | 'error' | 'advice';
  href?: string;
  actionLabel?: string;
  actionButton?: boolean;
  actionNewTab?: boolean;
  dismissLabel: string;
  onDismiss: () => void;
  onActivate?: () => void;
}) {
  const content = <><span className="block font-medium">{message}</span>{actionLabel && !actionButton ? <span className="mt-1 block py-1 text-xs font-semibold underline underline-offset-2">{actionLabel}</span> : null}</>;
  const actionClass = 'min-w-0 flex-1 rounded-lg py-0.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn(
    'pointer-events-auto flex w-full max-w-md shrink-0 items-center gap-3 rounded-2xl border border-white/20 bg-ink/90 py-3 pr-2 pl-4 text-sm text-white shadow-soft-lg backdrop-blur-xl backdrop-saturate-150 animate-in fade-in sm:slide-in-from-bottom-2',
    tone === 'error' && 'border-danger',
  )}>
    {tone === 'error' ? <WarningCircle weight="fill" className="size-6 shrink-0" aria-hidden="true" /> : tone === 'advice' ? <Sparkle weight="fill" className="size-6 shrink-0" aria-hidden="true" /> : <CheckCircle weight="fill" className="size-6 shrink-0" aria-hidden="true" />}
    {href && actionButton ? (
      <>
        <div className="min-w-0 flex-1 break-words">{content}</div>
        <Link href={href} target={actionNewTab ? '_blank' : undefined} rel={actionNewTab ? 'noopener noreferrer' : undefined} onClick={onDismiss} className={pill('onPhoto', 'px-3 text-xs focus-visible:outline-white')}>
          {actionLabel}
        </Link>
      </>
    ) : href ? <Link href={href} onClick={onDismiss} className={actionClass}>{content}</Link>
      : onActivate ? <button type="button" onClick={onActivate} className={cn(actionClass, 'cursor-pointer')}>{content}</button>
        : <div className={actionClass}>{content}</div>}
    <button type="button" onClick={onDismiss} aria-label={dismissLabel} className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
      <XMarkIcon className="size-4" aria-hidden="true" />
    </button>
  </div>;
}
