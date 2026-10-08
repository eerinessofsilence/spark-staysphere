'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { addSampleBookings } from '@/app/admin/actions';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralForm } from '@/lib/i18n/plural';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

/**
 * Fills an empty demo with a dozen believable stays (see
 * `lib/application/sample-bookings.ts`). The page re-renders from the
 * action's revalidation; the line below only speaks up when nothing was
 * added, which would otherwise look like the button did nothing.
 */
export function SampleBookingsButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const [pending, startTransition] = React.useTransition();
  const locale = useAdminLocale();
  const t = useAdminT();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { created } = await addSampleBookings();
            if (created > 0) {
              toast.success(
                pluralForm(locale, created, {
                  one: t('ops.sampleAddedOne', { count: created }),
                  few: t('ops.sampleAddedFew', { count: created }),
                  many: t('ops.sampleAddedMany', { count: created }),
                  other: t('ops.sampleAddedMany', { count: created }),
                }),
              );
            } else {
              toast.error(t('ops.sampleNothingAdded'));
            }
          })
        }
        className={pill(variant)}
      >
        {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? t('ops.addingSample') : t('ops.addSample')}
      </button>
      <Preloader active={pending} label={t('ops.addingSample')} />
    </div>
  );
}
