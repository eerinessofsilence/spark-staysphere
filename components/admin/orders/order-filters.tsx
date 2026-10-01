'use client';

import * as React from 'react';
import { FunnelIcon } from '@heroicons/react/24/outline';
import { pill } from '@/lib/ui';

interface OrderFiltersProps {
  initiallyOpen: boolean;
  label: string;
  children: React.ReactNode;
}

/** Keeps the filters trigger in the toolbar while its expanded controls take a full row below it. */
export function OrderFilters({ initiallyOpen, label, children }: OrderFiltersProps) {
  const [open, setOpen] = React.useState(initiallyOpen);

  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={pill('secondary', 'sm:ml-auto px-4')}>
        <FunnelIcon className="size-4" aria-hidden="true" />
        {label}
      </button>
      {open ? <div className="basis-full grid grid-cols-1 gap-2 rounded-2xl border border-border bg-stone/30 p-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div> : null}
    </>
  );
}
