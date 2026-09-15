'use client';

import type { ReactNode } from 'react';
import { Tabs } from '@base-ui/react/tabs';

const tabClass =
  'flex min-h-10 shrink-0 cursor-pointer items-center rounded-full px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent data-active:bg-card data-active:text-foreground data-active:shadow-soft';

export interface HotelSettingsTab {
  value: string;
  label: string;
  content: ReactNode;
}

/**
 * The panels of one form: every one stays mounted (`keepMounted`) so the
 * fields on whichever tab is not showing still travel with the submit, and
 * "Save hotel details" saves the whole hotel either way.
 */
export function HotelSettingsTabs({ tabs }: { tabs: HotelSettingsTab[] }) {
  return (
    <Tabs.Root defaultValue={tabs[0]?.value}>
      <Tabs.List
        aria-label="Hotel settings"
        className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-stone/60 p-1 sm:inline-flex"
      >
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value} className={tabClass}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Panel key={tab.value} value={tab.value} keepMounted className="mt-6 outline-none">
          {tab.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
