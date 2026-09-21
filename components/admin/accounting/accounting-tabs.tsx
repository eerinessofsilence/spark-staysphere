'use client';

import Link from 'next/link';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'overview', href: '/admin/accounting', label: 'accounting.tabOverview' },
  { key: 'reports', href: '/admin/accounting/reports', label: 'accounting.tabReports' },
] as const satisfies readonly { key: string; href: string; label: AdminTranslationKey }[];

export type AccountingTab = (typeof tabs)[number]['key'];

/** Same shape as `CatalogTabs`/`TeamTabs`: the ledger first, since a report is a formatted slice of the same bookings it shows. */
export function AccountingTabs({ current }: { current: AccountingTab }) {
  const t = useAdminT();
  return (
    <nav aria-label={t('nav.accounting')} className="mt-6">
      <ul className="flex w-full items-center gap-1 rounded-full border border-border bg-card p-1 sm:w-max">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key} className="min-w-0 flex-1 sm:flex-none">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                )}
              >
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
