'use client';

import * as React from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { setHousekeepingStatusAction } from '@/app/admin/housekeeping/actions';
import { HOUSEKEEPING_STATUSES } from '@/lib/domain/housekeeping';
import type { HousekeepingStatus } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { housekeepingStatusKey } from '@/lib/i18n/admin/housekeeping';
import { menuItemClass } from '@/components/admin/operations/booking-row-actions';
import { toast } from '@/components/admin/shell/toast';
import { cn } from '@/lib/utils';
import { HousekeepingStatusBadge, housekeepingStatusIcons } from './housekeeping-status-badge';

/**
 * The status badge as a control, the way a stay's badge is on the desk:
 * press it and every other status is a row. Keeps whatever note the room
 * already carries — the note is edited on the room's own page.
 */
export function HousekeepingStatusMenu({
  unitId,
  status,
  note,
  hotelSlug,
}: {
  unitId: string;
  status: HousekeepingStatus;
  note: string | null;
  hotelSlug?: string;
}) {
  const router = useRouter();
  const t = useAdminT();
  const [pending, setPending] = React.useState(false);

  const move = async (next: HousekeepingStatus) => {
    setPending(true);
    const result = await setHousekeepingStatusAction(unitId, next, note ?? '', null, crypto.randomUUID(), hotelSlug);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        disabled={pending}
        aria-label={t('housekeeping.changeStatus')}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60"
      >
        <HousekeepingStatusBadge status={status} className="pr-2" />
        {pending ? (
          <ArrowPathIcon className="-ml-1 mr-2 size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDownIcon className="-ml-1 mr-2 size-3.5 text-muted-foreground" aria-hidden="true" />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[60] outline-none">
          <Menu.Popup className="min-w-52 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
            {HOUSEKEEPING_STATUSES.filter((option) => option !== status && option !== 'clean').map((option) => {
              const Icon = housekeepingStatusIcons[option];
              return (
                <Menu.Item key={option} onClick={() => move(option)} className={cn(menuItemClass)}>
                  <Icon weight="fill" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {t(housekeepingStatusKey(option))}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
