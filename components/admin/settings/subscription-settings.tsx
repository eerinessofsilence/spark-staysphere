'use client';

import * as React from 'react';
import { CreditCard, CurrencyBtc } from '@phosphor-icons/react/dist/ssr';
import { CheckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { lDate, lMoney } from '@/lib/i18n/format';
import { fieldClass, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { ClientPagination, paginateClient } from '@/components/admin/operations/client-pagination';
import { Meter } from '@/components/admin/operations/metric-card';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CARD_BRANDS,
  CRYPTO_CURRENCIES,
  currentPlanId,
  invoices,
  nextBillingDate,
  paymentMethod as initialPaymentMethod,
  plans,
  usage,
  type PaymentMethod,
  type PlanId,
} from './subscription-data';

const METHOD_KINDS: { kind: PaymentMethod['kind']; icon: typeof CreditCard; label: AdminTranslationKey; hint: AdminTranslationKey }[] = [
  { kind: 'card', icon: CreditCard, label: 'subscription.methodCard', hint: 'subscription.methodCardHint' },
  { kind: 'crypto', icon: CurrencyBtc, label: 'subscription.methodCrypto', hint: 'subscription.methodCryptoHint' },
];

/** `0x9F2c…4b1A` — enough of a wallet address to recognise, none of it to mistake for the whole thing. */
function truncateAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

type CancelReason = 'price' | 'missingFeatures' | 'switching' | 'closing' | 'other';

const CANCEL_REASONS: { id: CancelReason; label: AdminTranslationKey }[] = [
  { id: 'price', label: 'subscription.cancelReasonPrice' },
  { id: 'missingFeatures', label: 'subscription.cancelReasonMissingFeatures' },
  { id: 'switching', label: 'subscription.cancelReasonSwitching' },
  { id: 'closing', label: 'subscription.cancelReasonClosing' },
  { id: 'other', label: 'subscription.cancelReasonOther' },
];

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

/** What one room or one channel beyond the plan's own allowance costs, per month — demo pricing only. */
const EXTRA_ROOM_PRICE = 0.9;
const EXTRA_CHANNEL_PRICE = 15;

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
  const [selectedPlanId, setSelectedPlanId] = React.useState<PlanId>(currentPlanId);
  const plan = plans.find((candidate) => candidate.id === planId)!;
  const selectedPlan = plans.find((candidate) => candidate.id === selectedPlanId)!;

  const [payOpen, setPayOpen] = React.useState(false);
  const closePayModal = () => {
    setPayOpen(false);
    setSelectedPlanId(planId);
  };

  const [roomLimitOverride, setRoomLimitOverride] = React.useState<number | null>(null);
  const [channelLimitOverride, setChannelLimitOverride] = React.useState<number | null>(null);
  const roomLimit = roomLimitOverride ?? plan.roomLimit;
  const channelLimit = channelLimitOverride ?? plan.channelLimit;
  const extraRooms = plan.roomLimit !== null && roomLimit !== null ? Math.max(0, roomLimit - plan.roomLimit) : 0;
  const extraChannels =
    plan.channelLimit !== null && channelLimit !== null ? Math.max(0, channelLimit - plan.channelLimit) : 0;
  const addonCost = extraRooms * EXTRA_ROOM_PRICE + extraChannels * EXTRA_CHANNEL_PRICE;
  const totalPrice = plan.price + addonCost;

  const [planEditOpen, setPlanEditOpen] = React.useState(false);
  const [roomsDraft, setRoomsDraft] = React.useState('');
  const [channelsDraft, setChannelsDraft] = React.useState('');
  const roomsDraftNum = Number(roomsDraft) || 0;
  const channelsDraftNum = Number(channelsDraft) || 0;
  const extraRoomsDraft = plan.roomLimit !== null ? Math.max(0, roomsDraftNum - plan.roomLimit) : 0;
  const extraChannelsDraft = plan.channelLimit !== null ? Math.max(0, channelsDraftNum - plan.channelLimit) : 0;
  const addonCostDraft = extraRoomsDraft * EXTRA_ROOM_PRICE + extraChannelsDraft * EXTRA_CHANNEL_PRICE;

  const [invoicePage, setInvoicePage] = React.useState(1);
  const { pageItems: invoicePageItems, page: invoiceCurrentPage, totalPages: invoiceTotalPages } = paginateClient(
    invoices,
    invoicePage,
  );

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [reason, setReason] = React.useState<CancelReason | ''>('');
  const [comment, setComment] = React.useState('');
  const endDate = lDate(nextBillingDate, locale);

  const [activePaymentMethod, setActivePaymentMethod] = React.useState<PaymentMethod>(initialPaymentMethod);
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    // Back to "Confirm payment" if a plan switch was in progress when the card was opened.
    if (selectedPlanId !== planId) setPayOpen(true);
  };
  const [methodKindDraft, setMethodKindDraft] = React.useState<PaymentMethod['kind']>(initialPaymentMethod.kind);
  const [cardBrandDraft, setCardBrandDraft] = React.useState<string>(CARD_BRANDS[0]);
  const [cardLast4Draft, setCardLast4Draft] = React.useState('');
  const [cardExpiryDraft, setCardExpiryDraft] = React.useState('');
  const [cryptoCurrencyDraft, setCryptoCurrencyDraft] = React.useState<string>(CRYPTO_CURRENCIES[0]);
  const [cryptoAddressDraft, setCryptoAddressDraft] = React.useState('');

  const openPaymentModal = () => {
    setMethodKindDraft(activePaymentMethod.kind);
    if (activePaymentMethod.kind === 'card') {
      setCardBrandDraft(activePaymentMethod.brand);
      setCardLast4Draft(activePaymentMethod.last4);
      setCardExpiryDraft(activePaymentMethod.expiry);
    } else {
      setCryptoCurrencyDraft(activePaymentMethod.currency);
      setCryptoAddressDraft(activePaymentMethod.address);
    }
    setPaymentModalOpen(true);
  };

  const canSavePaymentMethod =
    methodKindDraft === 'card'
      ? /^\d{4}$/.test(cardLast4Draft) && cardExpiryDraft.trim().length > 0
      : cryptoAddressDraft.trim().length > 0;

  const confirmPaymentMethod = () => {
    if (!canSavePaymentMethod) return;
    setActivePaymentMethod(
      methodKindDraft === 'card'
        ? { kind: 'card', brand: cardBrandDraft, last4: cardLast4Draft, expiry: cardExpiryDraft.trim() }
        : { kind: 'crypto', currency: cryptoCurrencyDraft, address: cryptoAddressDraft.trim() },
    );
    closePaymentModal();
  };

  const switchToPlan = (next: PlanId) => {
    setSelectedPlanId(next);
    setPayOpen(true);
  };

  const confirmPlanChange = () => {
    setPlanId(selectedPlanId);
    setRoomLimitOverride(null);
    setChannelLimitOverride(null);
    setPayOpen(false);
  };

  const openPlanEdit = () => {
    setRoomsDraft(String(roomLimit ?? ''));
    setChannelsDraft(String(channelLimit ?? ''));
    setPlanEditOpen(true);
  };

  const confirmPlanEdit = () => {
    if (roomsDraftNum > 0) setRoomLimitOverride(Math.round(roomsDraftNum));
    if (channelsDraftNum > 0) setChannelLimitOverride(Math.round(channelsDraftNum));
    setPlanEditOpen(false);
  };

  const closeCancel = () => setCancelOpen(false);

  const confirmCancel = () => {
    if (!reason) return;
    setCancelled(true);
    setCancelOpen(false);
  };

  const resumeSubscription = () => {
    setCancelled(false);
    setReason('');
    setComment('');
  };

  return (
    <div className="grid gap-6">
      <Group
        id="plan"
        title={t('subscription.currentPlan')}
        description={
          cancelled
            ? t('subscription.cancelsOn', { date: endDate })
            : t('subscription.renews', { date: endDate, price: lMoney(plan.price, 'EUR', locale) })
        }
        actions={
          plan.roomLimit !== null || plan.channelLimit !== null ? (
            <button type="button" onClick={openPlanEdit} className={pill('primary')}>
              <PencilSquareIcon className="size-4" aria-hidden="true" />
              {t('subscription.editPlan')}
            </button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-stone/60 p-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-display text-2xl">{plan.name}</p>
              <span className={tag(cancelled ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
                {cancelled ? t('subscription.cancelPending', { date: endDate }) : t('subscription.active')}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t(PLAN_COPY[plan.id].tagline)}</p>
          </div>
          <div className="text-right">
            <p className="text-display text-3xl">
              {lMoney(totalPrice, 'EUR', locale)}
              <span className="text-sm font-normal text-muted-foreground"> {t('subscription.perMonth')}</span>
            </p>
            {addonCost > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('subscription.basePlanPlusAddons', {
                  base: lMoney(plan.price, 'EUR', locale),
                  addons: lMoney(addonCost, 'EUR', locale),
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <UsageRow label={t('subscription.rooms')} used={usage.roomsUsed} limit={roomLimit} />
          <UsageRow label={t('subscription.channels')} used={usage.channelsUsed} limit={channelLimit} />
        </div>
      </Group>

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-lg font-medium">
          {t('subscription.changePlan')}
        </h2>

        <div className="mt-5 overflow-hidden rounded-[18px] border border-border bg-card">
          <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {plans.map((option) => {
              const isCurrent = option.id === planId;
              return (
                <div key={option.id} className="flex flex-col p-6">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                    <p className="font-medium">{option.name}</p>
                    {isCurrent ? (
                      <span className={tag(cancelled ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
                        {cancelled ? t('subscription.cancelPending', { date: endDate }) : t('subscription.currentTag')}
                      </span>
                    ) : null}
                  </div>

                  <div className="border-b border-border py-4">
                    <p className="text-display text-3xl">{lMoney(option.price, 'EUR', locale)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{t('subscription.perMonth')}</p>
                  </div>

                  <ul className="grid flex-1 gap-2.5 py-4 text-sm">
                    {PLAN_COPY[option.id].features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                        {t(feature)}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    cancelled ? (
                      <button type="button" onClick={resumeSubscription} className={pill('secondary')}>
                        {t('subscription.resume')}
                      </button>
                    ) : (
                      <button type="button" disabled className={pill('secondary', 'cursor-default opacity-60')}>
                        {t('subscription.currentPlanButton')}
                      </button>
                    )
                  ) : (
                    <button type="button" onClick={() => switchToPlan(option.id)} className={pill('primary')}>
                      {t('subscription.switchTo', { name: option.name })}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('subscription.addonNote', {
            roomPrice: lMoney(EXTRA_ROOM_PRICE, 'EUR', locale),
            channelPrice: lMoney(EXTRA_CHANNEL_PRICE, 'EUR', locale),
          })}
        </p>
      </section>

      <Group id="payment" title={t('subscription.paymentMethod')}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PaymentMethodSummary method={activePaymentMethod} t={t} />
          <button type="button" onClick={openPaymentModal} className={pill('secondary')}>
            {t('subscription.updatePayment')}
          </button>
        </div>
      </Group>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-medium">
          {t('subscription.billingHistory')}
        </h2>
        <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft">
          <TableCard caption={t('subscription.billingHistory')} className="min-w-[28rem]" attached>
            <thead>
              <tr className="border-b border-border">
                <Th>{t('subscription.thInvoice')}</Th>
                <Th className="text-right">{t('subscription.thAmount')}</Th>
                <Th>{t('subscription.thStatus')}</Th>
              </tr>
            </thead>
            <tbody>
              {invoicePageItems.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border last:border-b-0">
                  <Td className="font-medium whitespace-nowrap">
                    {invoice.id}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {lDate(invoice.issuedOn, locale)}
                    </span>
                  </Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">{lMoney(invoice.amount, 'EUR', locale)}</Td>
                  <Td>
                    <span className={tag(invoice.status === 'paid' ? 'bg-success/10 text-success' : undefined)}>
                      {invoice.status === 'paid' ? t('subscription.paid') : t('subscription.upcoming')}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          <ClientPagination
            attached
            page={invoiceCurrentPage}
            totalPages={invoiceTotalPages}
            total={invoices.length}
            onPageChange={setInvoicePage}
          />
        </div>
      </section>

      <div role="group" aria-label={t('subscription.cancel')} className="rounded-[18px] bg-card p-6 text-center shadow-soft">
        {cancelled ? (
          <>
            <p className="text-sm text-muted-foreground">{t('subscription.cancelledNotice', { date: endDate })}</p>
            <button type="button" onClick={resumeSubscription} className={cn(pill('secondary'), 'mt-3')}>
              {t('subscription.resume')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="text-sm font-semibold text-danger hover:underline"
          >
            {t('subscription.cancel')}
          </button>
        )}
      </div>

      <Modal open={cancelOpen} onClose={closeCancel} title={t('subscription.cancel')}>
        <p className="text-sm text-muted-foreground">{t('subscription.cancelWarning', { date: endDate })}</p>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium">{t('subscription.cancelReasonLabel')}</legend>
          <div className="grid gap-2">
            {CANCEL_REASONS.map((option) => (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors',
                  reason === option.id ? 'border-foreground bg-stone/60' : 'border-border hover:bg-stone/40',
                )}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={option.id}
                  checked={reason === option.id}
                  onChange={() => setReason(option.id)}
                />
                {t(option.label)}
              </label>
            ))}
          </div>
        </fieldset>

        {reason === 'other' ? (
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t('subscription.cancelReasonOtherPlaceholder')}
            rows={3}
            className={cn(fieldClass, 'mt-3 min-h-24 resize-y py-2.5')}
          />
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={confirmCancel} disabled={!reason} className={pill('primary', 'disabled:opacity-50')}>
            {t('subscription.cancel')}
          </button>
          <button type="button" onClick={closeCancel} className={pill('secondary')}>
            {t('subscription.keepSubscription')}
          </button>
        </div>
      </Modal>

      <Modal open={payOpen} onClose={closePayModal} title={t('subscription.confirmPayment')}>
        <div className="rounded-2xl border border-border p-4 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t('subscription.planChangeFrom', { name: plan.name })}</span>
            <span className="tabular-nums">{lMoney(plan.price, 'EUR', locale)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 font-medium">
            <span>{t('subscription.planChangeTo', { name: selectedPlan.name })}</span>
            <span className="tabular-nums">
              {lMoney(selectedPlan.price, 'EUR', locale)} {t('subscription.perMonth')}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <PaymentMethodSummary method={activePaymentMethod} t={t} />
          <button
            type="button"
            onClick={() => {
              setPayOpen(false);
              openPaymentModal();
            }}
            className="text-sm font-medium text-foreground hover:text-accent-strong"
          >
            {t('subscription.changeCard')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={confirmPlanChange} className={pill('primary')}>
            {t('subscription.payAndConfirm')}
          </button>
          <button type="button" onClick={closePayModal} className={pill('secondary')}>
            {t('subscription.editCancel')}
          </button>
        </div>
      </Modal>

      <Modal open={planEditOpen} onClose={() => setPlanEditOpen(false)} title={t('subscription.editPlan')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="subscription-rooms" className="mb-1.5 block text-sm text-muted-foreground">
              {t('subscription.rooms')}
            </label>
            <input
              id="subscription-rooms"
              type="number"
              min={1}
              value={roomsDraft}
              onChange={(event) => setRoomsDraft(event.target.value)}
              className={fieldClass}
            />
            {plan.roomLimit !== null ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t('subscription.includedInPlan', { count: plan.roomLimit })}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="subscription-channels" className="mb-1.5 block text-sm text-muted-foreground">
              {t('subscription.channels')}
            </label>
            <input
              id="subscription-channels"
              type="number"
              min={1}
              value={channelsDraft}
              onChange={(event) => setChannelsDraft(event.target.value)}
              className={fieldClass}
            />
            {plan.channelLimit !== null ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t('subscription.includedInPlan', { count: plan.channelLimit })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-1.5 rounded-2xl bg-stone/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('subscription.basePlanLine', { name: plan.name })}</span>
            <span className="tabular-nums">{lMoney(plan.price, 'EUR', locale)}</span>
          </div>
          {extraRoomsDraft > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('subscription.extraRoomsLine', { count: extraRoomsDraft })}
              </span>
              <span className="tabular-nums">+{lMoney(extraRoomsDraft * EXTRA_ROOM_PRICE, 'EUR', locale)}</span>
            </div>
          ) : null}
          {extraChannelsDraft > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('subscription.extraChannelsLine', { count: extraChannelsDraft })}
              </span>
              <span className="tabular-nums">+{lMoney(extraChannelsDraft * EXTRA_CHANNEL_PRICE, 'EUR', locale)}</span>
            </div>
          ) : null}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-medium">
            <span>{t('subscription.newTotal')}</span>
            <span className="tabular-nums">
              {lMoney(plan.price + addonCostDraft, 'EUR', locale)} {t('subscription.perMonth')}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={confirmPlanEdit} className={pill('primary')}>
            {t('subscription.saveLimit')}
          </button>
          <button type="button" onClick={() => setPlanEditOpen(false)} className={pill('secondary')}>
            {t('subscription.editCancel')}
          </button>
        </div>
      </Modal>

      <Modal open={paymentModalOpen} onClose={closePaymentModal} title={t('subscription.paymentMethodModalTitle')}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('subscription.paymentMethodType')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {METHOD_KINDS.map((option) => {
              const active = option.kind === methodKindDraft;
              const Icon = option.icon;
              return (
                <label
                  key={option.kind}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors',
                    active ? 'border-foreground bg-stone/60' : 'border-border hover:bg-stone/40',
                  )}
                >
                  <input
                    type="radio"
                    name="payment-method-kind"
                    value={option.kind}
                    checked={active}
                    onChange={() => setMethodKindDraft(option.kind)}
                    className="mt-1"
                  />
                  <Icon weight="fill" className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    <span className="block font-medium">{t(option.label)}</span>
                    <span className="block text-xs text-muted-foreground">{t(option.hint)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {methodKindDraft === 'card' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="payment-card-brand" className="mb-1.5 block text-sm text-muted-foreground">
                {t('subscription.cardBrand')}
              </label>
              <Select value={cardBrandDraft} onValueChange={(next) => setCardBrandDraft(next ?? CARD_BRANDS[0])}>
                <SelectTrigger id="payment-card-brand" className={cn(fieldClass, 'justify-between gap-2 py-0')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
                  {CARD_BRANDS.map((brand) => (
                    <SelectItem
                      key={brand}
                      value={brand}
                      className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
                    >
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="payment-card-last4" className="mb-1.5 block text-sm text-muted-foreground">
                {t('subscription.cardLast4')}
              </label>
              <input
                id="payment-card-last4"
                inputMode="numeric"
                maxLength={4}
                placeholder="4242"
                value={cardLast4Draft}
                onChange={(event) => setCardLast4Draft(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="payment-card-expiry" className="mb-1.5 block text-sm text-muted-foreground">
                {t('subscription.cardExpiry')}
              </label>
              <input
                id="payment-card-expiry"
                placeholder="MM/YY"
                maxLength={5}
                value={cardExpiryDraft}
                onChange={(event) => setCardExpiryDraft(event.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="payment-crypto-currency" className="mb-1.5 block text-sm text-muted-foreground">
                {t('subscription.cryptoCurrency')}
              </label>
              <Select
                value={cryptoCurrencyDraft}
                onValueChange={(next) => setCryptoCurrencyDraft(next ?? CRYPTO_CURRENCIES[0])}
              >
                <SelectTrigger id="payment-crypto-currency" className={cn(fieldClass, 'justify-between gap-2 py-0')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
                  {CRYPTO_CURRENCIES.map((currency) => (
                    <SelectItem
                      key={currency}
                      value={currency}
                      className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
                    >
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="payment-crypto-address" className="mb-1.5 block text-sm text-muted-foreground">
                {t('subscription.cryptoAddress')}
              </label>
              <input
                id="payment-crypto-address"
                placeholder="0x..."
                spellCheck={false}
                value={cryptoAddressDraft}
                onChange={(event) => setCryptoAddressDraft(event.target.value)}
                className={cn(fieldClass, 'font-mono')}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirmPaymentMethod}
            disabled={!canSavePaymentMethod}
            className={pill('primary', 'disabled:opacity-50')}
          >
            {t('subscription.savePaymentMethod')}
          </button>
          <button type="button" onClick={closePaymentModal} className={pill('secondary')}>
            {t('subscription.editCancel')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function PaymentMethodSummary({ method, t }: { method: PaymentMethod; t: AdminT }) {
  const Icon = method.kind === 'card' ? CreditCard : CurrencyBtc;
  return (
    <span className="flex items-center gap-3 text-sm">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-stone">
        <Icon weight="fill" className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      {method.kind === 'card' ? (
        <span>
          <span className="block font-medium">
            {method.brand} •••• {method.last4}
          </span>
          <span className="block text-muted-foreground">{t('subscription.expires', { expiry: method.expiry })}</span>
        </span>
      ) : (
        <span>
          <span className="block font-medium">{t('subscription.cryptoWallet', { currency: method.currency })}</span>
          <span className="block font-mono text-muted-foreground">{truncateAddress(method.address)}</span>
        </span>
      )}
    </span>
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
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={`${id}-heading`} className="rounded-[18px] bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-heading`} className="text-lg font-medium">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}
