import { ArrowCounterClockwise, CheckCircle, Clock, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { PaymentAttempt, PaymentMethod } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { adminT, type AdminT } from '@/lib/i18n/admin/translate';
import { PAYMENT_METHOD_LABEL, lPaymentMethod } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

/** A manually-recorded provider outside the guest checkout's own `PaymentMethod` — see `AddPaymentButton`. */
const MANUAL_METHOD_KEY: Partial<Record<string, AdminTranslationKey>> = {
  pos: 'accounting.methodPos',
  cash: 'accounting.methodCash',
};

/** A payment provider's name in the team member's language; an unknown provider is shown as recorded. */
export function methodLabel(provider: string, locale: AdminLocale): string {
  if (provider in PAYMENT_METHOD_LABEL.en) return lPaymentMethod(provider as PaymentMethod, locale);
  const key = MANUAL_METHOD_KEY[provider];
  return key ? adminT(locale)(key) : provider;
}

const ATTEMPT_STATUS: Record<PaymentAttempt['status'], { key: AdminTranslationKey; tone: string; icon: typeof CheckCircle }> = {
  authorized: { key: 'ops.paymentAuthorized', tone: 'text-status-confirmed', icon: CheckCircle },
  demo_pending: { key: 'ops.paymentPending', tone: 'text-status-new', icon: Clock },
  failed: { key: 'ops.paymentDeclined', tone: 'text-status-no-show', icon: XCircle },
  refunded: { key: 'ops.paymentRefunded', tone: 'text-status-checked-out', icon: ArrowCounterClockwise },
};

/** Status is never colour alone: a filled mark and the words, per DESIGN_SYSTEM.md rule 10. */
export function attemptStatus(
  status: PaymentAttempt['status'],
  t: AdminT,
): { label: string; tone: string; icon: typeof CheckCircle } {
  const { key, tone, icon } = ATTEMPT_STATUS[status];
  return { label: t(key), tone, icon };
}

export function PaymentSummary({ payments, locale }: { payments: PaymentAttempt[]; locale: AdminLocale }) {
  const t = adminT(locale);
  const paid = payments.filter((payment) => payment.status === 'authorized').reduce((sum, payment) => sum + payment.amount, 0);
  const refunded = payments.filter((payment) => payment.status === 'refunded').reduce((sum, payment) => sum + payment.amount, 0);
  const authorized = paid - refunded > 0;
  const fullyRefunded = paid > 0 && paid - refunded <= 0;
  const last = payments.at(-1);
  const Icon = authorized ? CheckCircle : fullyRefunded ? ArrowCounterClockwise : payments.length > 0 ? Clock : XCircle;
  const label = authorized ? t('ops.paymentAuthorized') : fullyRefunded ? t('ops.paymentRefunded') : payments.length > 0 ? t('ops.awaitingPayment') : t('ops.noAttempt');

  return (
    <span className="flex flex-col">
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground whitespace-nowrap">
        <Icon weight="fill" className={cn('size-4 shrink-0', authorized ? 'text-status-confirmed' : fullyRefunded ? 'text-status-checked-out' : 'text-status-new')} aria-hidden="true" />
        {label}
      </span>
      {last ? <span className="text-xs text-muted-foreground">{methodLabel(last.provider, locale)}</span> : null}
    </span>
  );
}
