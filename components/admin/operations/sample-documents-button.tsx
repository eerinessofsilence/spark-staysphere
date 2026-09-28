'use client';

import * as React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { addSampleDocuments } from '@/app/admin/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

/**
 * `SampleBookingsButton`'s twin for `/admin/documents`: one press seeds a
 * synthetic passport onto a few stays in every property (see
 * `lib/application/sample-documents.ts`), so switching hotels never lands
 * on an empty grid. The page re-renders from the action's revalidation.
 */
export function SampleDocumentsButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const [pending, startTransition] = React.useTransition();
  const t = useAdminT();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { created } = await addSampleDocuments();
          if (created > 0) toast.success(t('documents.sampleAdded', { count: created }));
          else toast.error(t('documents.sampleNothingAdded'));
        })
      }
      className={pill(variant)}
    >
      {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? t('documents.addingSample') : t('documents.addSample')}
    </button>
  );
}
