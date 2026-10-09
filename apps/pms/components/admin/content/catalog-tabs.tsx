'use client';

import Link from 'next/link';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';

/** Services have their own sidebar item now, so the Rooms section is just its two kinds of room. */
const tabs = [
  { key: 'types', href: '/admin/content', label: 'rooms.title' },
  { key: 'rooms', href: '/admin/content/units', label: 'nav.rooms' },
] as const satisfies readonly { key: string; href: string; label: AdminTranslationKey }[];

export type CatalogTab = (typeof tabs)[number]['key'];

/** Room types come first on purpose: a room can only be added under a type that already exists. */
export function CatalogTabs({ current, counts }: { current: CatalogTab; counts: Record<CatalogTab, number> }) {
  const t = useAdminT();
  return (
    <nav aria-label={t('nav.rooms')} className="mt-6">
      {/* A phone splits the width between the two and drops the counts, so no tab ever scrolls out of view. */}
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
