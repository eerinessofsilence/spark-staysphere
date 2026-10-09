'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { addSampleReportsAction } from '@/app/admin/accounting/reports/generated/actions';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralForm } from '@/lib/i18n/plural';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

/**
 * Fills an empty "Generated" tab with today's arrivals, departures and
 * in-house reports — the same convenience `SampleBookingsButton` gives the
 * ledger. The router refresh below is enough since the action's own
 * `revalidatePath` already refreshed the server data.
 */
export function SampleReportsButton() {
  const [pending, startTransition] = React.useTransition();
  const locale = useAdminLocale();
  const t = useAdminT();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { created } = await addSampleReportsAction();
            if (created > 0) {
              toast.success(
                pluralForm(locale, created, {
                  one: t('reports.sampleAddedOne', { count: created }),
                  few: t('reports.sampleAddedFew', { count: created }),
                  many: t('reports.sampleAddedMany', { count: created }),
                  other: t('reports.sampleAddedMany', { count: created }),
                }),
              );
            } else {
              toast.error(t('reports.sampleNothingAdded'));
            }
          })
        }
        className={pill('secondary')}
      >
        {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? t('reports.addingSample') : t('reports.addSample')}
      </button>
      <Preloader active={pending} label={t('page.loading')} />
    </>
  );
}
