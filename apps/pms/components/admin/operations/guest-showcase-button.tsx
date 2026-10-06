'use client';

import * as React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { provisionGuestShowcase } from '@/app/admin/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

export function GuestShowcaseButton() {
  const [pending, startTransition] = React.useTransition();
  const t = useAdminT();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { available } = await provisionGuestShowcase();
          if (available > 0) toast.success(t('ops.guestShowcaseReady', { count: available }));
          else toast.error(t('ops.sampleNothingAdded'));
        })
      }
      className={pill('secondary')}
    >
      {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? t('ops.preparingGuestShowcase') : t('ops.addGuestShowcase')}
    </button>
  );
}
