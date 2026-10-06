import Link from 'next/link';
import { ChartBar, Money, Receipt } from '@phosphor-icons/react/dist/ssr';
import { getAdminT } from '@/lib/i18n/admin/server';
import { cn } from '@/lib/utils';

export async function AccountingTabs({ current }: { current: 'payments' | 'invoices' | 'statistics' }) {
  const t = await getAdminT();
  const tabs = [
    { key: 'payments', href: '/admin/accounting', label: t('accounting.payments'), icon: Money },
    { key: 'invoices', href: '/admin/accounting/invoices', label: t('booking.invoices'), icon: Receipt },
    { key: 'statistics', href: '/admin/accounting/statistics', label: t('reports.statistics'), icon: ChartBar },
  ] as const;
  return (
    <nav aria-label={t('nav.accounting')} className="mt-6">
      <ul className="flex w-full items-center gap-1 rounded-full border border-border bg-card p-1 sm:w-max">
        {tabs.map((tab) => (
          <li key={tab.key} className="min-w-0 flex-1 sm:flex-none">
            <Link href={tab.href} scroll={false} aria-current={tab.key === current ? 'page' : undefined}
              className={cn('flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                tab.key === current ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone hover:text-foreground')}>
              <tab.icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
