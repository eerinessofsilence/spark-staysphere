import { CheckCircle, Clock, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { PaymentAttempt, PaymentMethod } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { adminT, type AdminT } from '@/lib/i18n/admin/translate';
import { PAYMENT_METHOD_LABEL, lPaymentMethod } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

/** A payment provider's name in the team member's language; an unknown provider is shown as recorded. */
export function methodLabel(provider: string, locale: AdminLocale): string {
  return provider in PAYMENT_METHOD_LABEL.en ? lPaymentMethod(provider as PaymentMethod, locale) : provider;
}

const ATTEMPT_STATUS: Record<PaymentAttempt['status'], { key: AdminTranslationKey; tone: string; icon: typeof CheckCircle }> = {
  authorized: { key: 'ops.paymentAuthorized', tone: 'text-success', icon: CheckCircle },
  demo_pending: { key: 'ops.paymentPending', tone: 'text-warning', icon: Clock },
  failed: { key: 'ops.paymentDeclined', tone: 'text-danger', icon: XCircle },
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
  const authorized = payments.some((payment) => payment.status === 'authorized');
  const last = payments.at(-1);
  const Icon = authorized ? CheckCircle : payments.length > 0 ? Clock : XCircle;
  const label = authorized ? t('ops.paymentAuthorized') : payments.length > 0 ? t('ops.awaitingPayment') : t('ops.noAttempt');

  return (
    <span className="flex flex-col">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-medium whitespace-nowrap',
          authorized ? 'text-success' : 'text-warning',
        )}
      >
        <Icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </span>
      {last ? <span className="text-xs text-muted-foreground">{methodLabel(last.provider, locale)}</span> : null}
    </span>
  );
}
