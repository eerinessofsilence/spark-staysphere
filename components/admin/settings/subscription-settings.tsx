'use client';

import * as React from 'react';
import { CreditCard } from '@phosphor-icons/react/dist/ssr';
import { CheckIcon } from '@heroicons/react/24/outline';
import { formatDate, formatMoney } from '@/lib/formatting';
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
 * `/admin/account`'s "Subscription" section: the hotel's own plan on
 * StaySphere, not a guest's booking. Same shape as `AccountSettings` next to
 * it — local state only, nothing saved, a plan change previews instantly and
 * says so rather than pretending to charge a card.
 */
export function SubscriptionSettings() {
  const [planId, setPlanId] = React.useState<PlanId>(currentPlanId);
  const [notice, setNotice] = React.useState('');
  const plan = plans.find((candidate) => candidate.id === planId)!;

  const choosePlan = (next: PlanId) => {
    if (next === planId) return;
    setPlanId(next);
    const direction = plans.findIndex((p) => p.id === next) > plans.findIndex((p) => p.id === planId) ? 'up' : 'down';
    setNotice(
      `Demo — nothing was charged. A real change would take effect ${direction === 'up' ? 'immediately' : 'at the end of this billing period'}.`,
    );
  };

  return (
    <div className="grid gap-6">
      <Group
        id="plan"
        title="Current plan"
        description={`Renews ${formatDate(nextBillingDate)}, ${formatMoney(plan.price, 'EUR')} ${plan.priceUnit}.`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-stone/60 p-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-display text-2xl">{plan.name}</p>
              <span className={tag('bg-success/10 text-success')}>Active</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
          </div>
          <p className="text-display text-3xl">
            {formatMoney(plan.price, 'EUR')}
            <span className="text-sm font-normal text-muted-foreground"> /mo</span>
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <UsageRow
            label="Rooms"
            used={usage.roomsUsed}
            limit={plan.roomLimit}
          />
          <UsageRow
            label="Team seats"
            used={usage.seatsUsed}
            limit={plan.seatLimit}
          />
          <UsageRow
            label="Bookings this month"
            used={usage.bookingsThisMonth}
            limit={null}
          />
        </div>
      </Group>

      <Group id="plans" title="Change plan" description="Preview only — nothing here is billed.">
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
                  {formatMoney(option.price, 'EUR')}
                  <span className="text-xs font-normal text-muted-foreground"> /mo</span>
                </p>
                <ul className="mt-4 grid gap-1.5 text-xs text-muted-foreground">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {notice ? (
          <p role="status" aria-live="polite" className="mt-4 text-sm font-medium text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </Group>

      <Group id="payment" title="Payment method">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-3 text-sm">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-stone">
              <CreditCard weight="fill" className="size-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-medium">
                {paymentMethod.brand} •••• {paymentMethod.last4}
              </span>
              <span className="block text-muted-foreground">Expires {paymentMethod.expiry}</span>
            </span>
          </span>
          <button type="button" onClick={() => setNotice('Demo — no card details are collected here.')} className={pill('secondary')}>
            Update payment method
          </button>
        </div>
      </Group>

      <Group id="history" title="Billing history">
        <ul className="grid gap-1">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-3 text-sm last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block font-medium">{invoice.id}</span>
                <span className="block text-xs text-muted-foreground">{formatDate(invoice.issuedOn)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-medium tabular-nums">{formatMoney(invoice.amount, 'EUR')}</span>
                <span className={tag(invoice.status === 'paid' ? 'bg-success/10 text-success' : undefined)}>
                  {invoice.status === 'paid' ? 'Paid' : 'Upcoming'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Group>

      <Group id="cancel" title="Cancel subscription" description="This stays here — a real cancel needs a moment's confirmation.">
        <button
          type="button"
          onClick={() => setNotice('Demo — cancellation is disabled in this preview.')}
          className={pill('ghost', 'text-danger hover:bg-danger/10')}
        >
          Cancel subscription
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
