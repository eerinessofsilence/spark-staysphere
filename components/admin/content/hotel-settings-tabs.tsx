'use client';

import type { ReactNode } from 'react';
import { Tabs } from '@base-ui/react/tabs';

const tabClass =
  'flex min-h-10 cursor-pointer items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent data-active:bg-card data-active:text-foreground data-active:shadow-soft';

/**
 * Two panels of one form: both stay mounted (`keepMounted`) so the hidden
 * inputs on whichever tab is not showing still travel with the submit, and
 * "Save hotel details" saves the whole hotel either way.
 */
export function HotelSettingsTabs({ details, facilities }: { details: ReactNode; facilities: ReactNode }) {
  return (
    <Tabs.Root defaultValue="details">
      <Tabs.List aria-label="Hotel settings" className="inline-flex gap-1 rounded-full bg-stone/60 p-1">
        <Tabs.Tab value="details" className={tabClass}>
          Details
        </Tabs.Tab>
        <Tabs.Tab value="facilities" className={tabClass}>
          Facilities
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="details" keepMounted className="mt-6 outline-none">
        {details}
      </Tabs.Panel>
      <Tabs.Panel value="facilities" keepMounted className="mt-6 outline-none">
        {facilities}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
