'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { AnimatedTabList } from '@/components/admin/animated-tab-list';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';
import styles from './hotel-settings-tabs.module.css';

export interface HotelSettingsTab {
  value: string;
  label: string;
  content: ReactNode;
}

/**
 * These are page links like the Rooms tabs. Panels stay mounted so the shared
 * hotel form submits every section, regardless of which tab is visible.
 */
export function HotelSettingsTabs({ tabs, activeValue }: { tabs: HotelSettingsTab[]; activeValue: string }) {
  const t = useAdminT();
  const [selectedValue, setSelectedValue] = React.useState(activeValue);
  const [direction, setDirection] = React.useState<'forward' | 'backward' | null>(null);

  React.useEffect(() => {
    setSelectedValue(activeValue);
  }, [activeValue]);

  const selectTab = (value: string) => {
    const currentIndex = tabs.findIndex((tab) => tab.value === selectedValue);
    const nextIndex = tabs.findIndex((tab) => tab.value === value);
    if (value === selectedValue || nextIndex < 0) return;
    setDirection(nextIndex > currentIndex ? 'forward' : 'backward');
    setSelectedValue(value);
  };

  return (
    <div>
      <nav aria-label={t('hotel.tabsLabel')} className="mt-6">
        <AnimatedTabList group="hotel-settings" activeValue={selectedValue} className="flex w-full items-center gap-1 rounded-full border border-border bg-card p-1 sm:w-max">
          {tabs.map((tab) => (
            <li key={tab.value} className="min-w-0 flex-1 sm:flex-none">
              <Link
                href={`/admin/content/hotel?tab=${tab.value}`}
                data-preserve-unsaved
                data-tab-value={tab.value}
                aria-current={selectedValue === tab.value ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  selectTab(tab.value);
                }}
                className={cn(
                  'relative z-10 flex min-h-10 items-center justify-center rounded-full px-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4',
                  selectedValue === tab.value
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </AnimatedTabList>
      </nav>
      {tabs.map((tab) => (
        <section
          key={tab.value}
          hidden={selectedValue !== tab.value}
          className={cn(
            'mt-6',
            selectedValue === tab.value && direction === 'forward' && styles.enterForward,
            selectedValue === tab.value && direction === 'backward' && styles.enterBackward,
          )}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setDirection(null);
          }}
        >
          {tab.content}
        </section>
      ))}
    </div>
  );
}
