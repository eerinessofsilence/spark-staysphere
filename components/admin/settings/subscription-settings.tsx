'use client';

import * as React from 'react';
import { CreditCard } from '@phosphor-icons/react/dist/ssr';
import { CheckIcon } from '@heroicons/react/24/outline';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { lDate, lMoney } from '@/lib/i18n/format';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Meter } from '@/components/admin/operations/metric-card';
import {
  currentPlanId,
  invoices,
  nextBillingDate,
  paymentMethod,
  plans,
  usage,
  type PlanId,
} from './subscription-data';

/**
 * Each plan's tagline and feature list in the team member's language, keyed
 * by plan id — the English copy in `subscription-data.ts` is the source these
 * were translated from. The plan's name is a product name and stays as is.
 */
const PLAN_COPY: Record<PlanId, { tagline: AdminTranslationKey; features: AdminTranslationKey[] }> = {
  starter: {
    tagline: 'subscription.starterTagline',
    features: ['subscription.starterF1', 'subscription.starterF2', 'subscription.starterF3', 'subscription.starterF4'],
  },
  growth: {
    tagline: 'subscription.growthTagline',
    features: [
      'subscription.growthF1',
      'subscription.growthF2',
      'subscription.growthF3',
      'subscription.growthF4',
      'subscription.growthF5',
    ],
  },
  scale: {
    tagline: 'subscription.scaleTagline',
    features: [
      'subscription.scaleF1',
      'subscription.scaleF2',
      'subscription.scaleF3',
      'subscription.scaleF4',
      'subscription.scaleF5',
    ],
  },
};

/**
 * `/admin/account`'s "Subscription" section: the hotel's own plan on
 * StaySphere, not a guest's booking. Same shape as `AccountSettings` next to
 * it — local state only, nothing saved, a plan change previews instantly and
 * says so rather than pretending to charge a card.
 */
export function SubscriptionSettings() {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [planId, setPlanId] = React.useState<PlanId>(currentPlanId);
  const [notice, setNotice] = React.useState<'up' | 'down' | 'noCard' | 'cancelDisabled' | ''>('');
  const plan = plans.find((candidate) => candidate.id === planId)!;

  const choosePlan = (next: PlanId) => {
    if (next === planId) return;
    setPlanId(next);
    setNotice(plans.findIndex((p) => p.id === next) > plans.findIndex((p) => p.id === planId) ? 'up' : 'down');
  };

  const noticeText =
    notice === 'up'
      ? t('subscription.changedUp')
      : notice === 'down'
        ? t('subscription.changedDown')
        : notice === 'noCard'
          ? t('subscription.noCard')
          : notice === 'cancelDisabled'
            ? t('subscription.cancelDisabled')
            : '';

  return (
    <div className="grid gap-6">
      <Group
        id="plan"
        title={t('subscription.currentPlan')}
        description={t('subscription.renews', {
          date: lDate(nextBillingDate, locale),
          price: lMoney(plan.price, 'EUR', locale),
        })}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-stone/60 p-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-display text-2xl">{plan.name}</p>
              <span className={tag('bg-success/10 text-success')}>{t('subscription.active')}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t(PLAN_COPY[plan.id].tagline)}</p>
          </div>
          <p className="text-display text-3xl">
            {lMoney(plan.price, 'EUR', locale)}
            <span className="text-sm font-normal text-muted-foreground"> {t('subscription.perMonth')}</span>
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <UsageRow label={t('subscription.rooms')} used={usage.roomsUsed} limit={plan.roomLimit} />
          <UsageRow label={t('subscription.seats')} used={usage.seatsUsed} limit={plan.seatLimit} />
          <UsageRow label={t('subscription.bookingsThisMonth')} used={usage.bookingsThisMonth} limit={null} />
        </div>
      </Group>

      <Group id="plans" title={t('subscription.changePlan')} description={t('subscription.changePlanBody')}>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((option) => {
            const selected = option.id === planId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => choosePlan(option.id)}
                aria-pressed={selected}
                className={cn(
                  'flex cursor-pointer flex-col rounded-2xl border p-5 text-left transition-colors',
                  selected ? 'border-primary bg-stone/40' : 'border-border hover:bg-stone/30',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{option.name}</p>
                  {selected ? (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                      <CheckIcon className="size-3.5 stroke-[2.5]" />
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {lMoney(option.price, 'EUR', locale)}
                  <span className="text-xs font-normal text-muted-foreground"> {t('subscription.perMonth')}</span>
                </p>
                <ul className="mt-4 grid gap-1.5 text-xs text-muted-foreground">
                  {PLAN_COPY[option.id].features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                      {t(feature)}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {noticeText ? (
          <p role="status" aria-live="polite" className="mt-4 text-sm font-medium text-muted-foreground">
            {noticeText}
          </p>
        ) : null}
      </Group>

      <Group id="payment" title={t('subscription.paymentMethod')}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-3 text-sm">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-stone">
              <CreditCard weight="fill" className="size-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-medium">
                {paymentMethod.brand} •••• {paymentMethod.last4}
              </span>
              <span className="block text-muted-foreground">
                {t('subscription.expires', { expiry: paymentMethod.expiry })}
              </span>
            </span>
          </span>
          <button type="button" onClick={() => setNotice('noCard')} className={pill('secondary')}>
            {t('subscription.updatePayment')}
          </button>
        </div>
      </Group>

      <Group id="history" title={t('subscription.billingHistory')}>
        <ul className="grid gap-1">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-3 text-sm last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block font-medium">{invoice.id}</span>
                <span className="block text-xs text-muted-foreground">{lDate(invoice.issuedOn, locale)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-medium tabular-nums">{lMoney(invoice.amount, 'EUR', locale)}</span>
                <span className={tag(invoice.status === 'paid' ? 'bg-success/10 text-success' : undefined)}>
                  {invoice.status === 'paid' ? t('subscription.paid') : t('subscription.upcoming')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Group>

      <Group id="cancel" title={t('subscription.cancel')} description={t('subscription.cancelBody')}>
        <button
          type="button"
          onClick={() => setNotice('cancelDisabled')}
          className={pill('ghost', 'text-danger hover:bg-danger/10')}
        >
          {t('subscription.cancel')}
        </button>
      </Group>
    </div>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">
        {used}
        {limit !== null ? <span className="text-sm font-normal text-muted-foreground"> / {limit}</span> : null}
      </p>
      {limit !== null ? <Meter share={used / limit} /> : null}
    </div>
  );
}

function Group({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={`${id}-heading`} className="rounded-[18px] bg-card p-6 shadow-soft">
      <h2 id={`${id}-heading`} className="text-lg font-medium">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </div>
  );
}
