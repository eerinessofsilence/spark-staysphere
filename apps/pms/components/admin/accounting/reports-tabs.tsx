'use client';

import Link from 'next/link';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'online', href: '/admin/accounting/reports', label: 'reports.tabOnline' },
  { key: 'generated', href: '/admin/accounting/reports/generated', label: 'reports.tabGenerated' },
] as const satisfies readonly { key: string; href: string; label: AdminTranslationKey }[];

export type ReportsTab = (typeof tabs)[number]['key'];

/**
 * Online (live, unsaved — pick a filter, see the result now) against
 * Generated (past runs, saved to reopen later) — see `reports-service.ts`.
 */
export function ReportsTabs({ current }: { current: ReportsTab }) {
  const t = useAdminT();
  return (
    <nav aria-label={t('nav.reports')} className="mt-7 overflow-x-auto contain-inline-size print:hidden">
      <ul className="flex w-max items-end gap-1">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center justify-center rounded-t-[14px] border border-b-0 px-5 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'border-border bg-card text-foreground' : 'border-transparent bg-stone text-muted-foreground hover:bg-card hover:text-foreground',
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
