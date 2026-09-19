'use client';

import Link from 'next/link';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'members', href: '/admin/settings/team', label: 'team.members' },
  { key: 'roles', href: '/admin/settings/team/roles', label: 'team.roles' },
] as const satisfies readonly { key: string; href: string; label: AdminTranslationKey }[];

export type TeamTab = (typeof tabs)[number]['key'];

/** Same shape as `CatalogTabs`: a member can only be given a role that already exists, so Members comes first. */
export function TeamTabs({ current, counts }: { current: TeamTab; counts: Record<TeamTab, number> }) {
  const t = useAdminT();
  return (
    <nav aria-label={t('team.title')} className="mt-6">
      <ul className="flex w-full items-center gap-1 rounded-full border border-border bg-card p-1 sm:w-max">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key} className="min-w-0 flex-1 sm:flex-none">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                )}
              >
                {t(tab.label)}
                <span className="hidden tabular-nums opacity-70 sm:inline">{counts[tab.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
