import { Bank, CreditCard, DeviceMobile, Money, Receipt, Wallet } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';

const icons: Record<string, typeof CreditCard> = {
  card: CreditCard,
  pos: DeviceMobile,
  cash: Money,
  bank_transfer: Bank,
  apple_pay: Wallet,
  google_pay: Wallet,
  pay_at_hotel: Receipt,
};

/** The method label carries the meaning; the same decorative mark accompanies it throughout Accounting. */
export function PaymentMethodIcon({ method, className }: { method: string | null; className?: string }) {
  const Icon = method ? icons[method] ?? CreditCard : Receipt;
  return <Icon weight="fill" className={cn('size-4 shrink-0', className)} aria-hidden="true" />;
}
