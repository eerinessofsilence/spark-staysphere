import { CheckCircle, Clock, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { PaymentAttempt, PaymentMethod } from '@/lib/domain/schemas';
import { paymentMethodLabels } from '@/lib/formatting';
import { cn } from '@/lib/utils';

export function methodLabel(provider: string): string {
  return provider in paymentMethodLabels ? paymentMethodLabels[provider as PaymentMethod] : provider;
}

export const attemptStatus: Record<
  PaymentAttempt['status'],
  { label: string; tone: string; icon: typeof CheckCircle }
> = {
  authorized: { label: 'Authorized', tone: 'text-success', icon: CheckCircle },
  demo_pending: { label: 'Pending — settles later', tone: 'text-warning', icon: Clock },
  failed: { label: 'Declined', tone: 'text-danger', icon: XCircle },
};

export function PaymentSummary({ payments }: { payments: PaymentAttempt[] }) {
  const authorized = payments.some((payment) => payment.status === 'authorized');
  const last = payments.at(-1);
  const Icon = authorized ? CheckCircle : payments.length > 0 ? Clock : XCircle;
  const label = authorized ? 'Authorized' : payments.length > 0 ? 'Awaiting payment' : 'No attempt';

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
      {last ? <span className="text-xs text-muted-foreground">{methodLabel(last.provider)}</span> : null}
    </span>
  );
}
