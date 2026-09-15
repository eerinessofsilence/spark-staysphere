'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tapeChartHref } from './tape-chart-shared';

interface RoomTypeSelectProps {
  options: { id: string; name: string }[];
  value: string | null;
  from: string;
  days: number;
}

export function RoomTypeSelect({ options, value, from, days }: RoomTypeSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const items = [
    { value: '', label: 'All room types' },
    ...options.map((option) => ({ value: option.id, label: option.name })),
  ];

  return (
    <div className="w-full sm:w-64">
      <label htmlFor="tape-chart-room-type" className="sr-only">
        Room type
      </label>
      <Select
        items={items}
        value={value ?? ''}
        disabled={pending}
        onValueChange={(next) => {
          const type = next || null;
          startTransition(() => router.replace(tapeChartHref({ from, days, type }), { scroll: false }));
        }}
      >
        <SelectTrigger id="tape-chart-room-type" className={cn(fieldClass, 'justify-between gap-2 py-0 disabled:opacity-60')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
