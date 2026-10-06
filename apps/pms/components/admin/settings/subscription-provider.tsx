'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { SubscriptionAccount, SubscriptionStatus } from '@/lib/domain/subscription';
import { subscriptionStatus } from '@/lib/application/subscription-service';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, pill } from '@/lib/ui';
import { subscriptionTrialCopy } from './subscription-trial-copy';

const Context = createContext<{ status: SubscriptionStatus | null; setAccount: (account: SubscriptionAccount) => void }>({ status: null, setAccount: () => {} });
export const useSubscription = () => useContext(Context);

export function SubscriptionProvider({ account: initial, now: initialNow, children }: { account: SubscriptionAccount | null; now: number; children: ReactNode }) {
  const [account, setAccount] = useState(initial);
  const [now, setNow] = useState(initialNow);
  useEffect(() => { setAccount(initial); }, [initial]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  return <Context.Provider value={{ status: account ? subscriptionStatus(account, now) : null, setAccount }}>{children}</Context.Provider>;
}

export function SubscriptionNotice() {
  const { status } = useSubscription();
  const c = subscriptionTrialCopy(useAdminLocale());
  if (status?.state === 'demo-active') return null;
  return <div data-subscription-notice className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-foreground dark:bg-accent/10 sm:mx-6 lg:mt-6">
    <p className="min-w-0"><strong>{!status ? c.unavailable : status.state === 'trial' ? c.trial : c.expired}</strong>{status ? <span className="ml-2">{status.state === 'trial' ? c.remaining(status.daysLeft) : c.ended}</span> : null}</p>
    <Link href="/admin/account/subscription" className={pill('primary')}>{c.update}</Link>
  </div>;
}

/** Persistent until dismissed. The status strip keeps the purchase action visible afterward. */
export function SubscriptionExpiryToast() {
  const { status } = useSubscription();
  const c = subscriptionTrialCopy(useAdminLocale());
  const t = useAdminT();
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (status?.state !== 'expired' || dismissed === status.endsAt) return null;
  return <div data-subscription-expiry-toast role="alert" className="pointer-events-auto relative w-full max-w-md shrink-0 rounded-[18px] border-2 border-accent bg-accent p-5 text-primary-foreground shadow-soft-lg">
    <div className="flex items-start gap-3 pr-10">
      <WarningCircle weight="fill" className="mt-0.5 size-7 shrink-0" aria-hidden="true" />
      <div className="min-w-0"><p className="text-lg font-semibold">{c.expired}</p><p className="mt-2 text-sm">{c.invite}</p></div>
    </div>
    <button type="button" aria-label={t('toast.dismiss')} onClick={() => setDismissed(status.endsAt)} className={iconButton('light', 'absolute top-3 right-3 text-foreground')}><XMarkIcon className="size-5" aria-hidden="true" /></button>
    <Link href="/admin/account/subscription" onClick={() => setDismissed(status.endsAt)} className={pill('primary', 'mt-4 w-full border border-primary-foreground/30')}>{c.update}</Link>
  </div>;
}
