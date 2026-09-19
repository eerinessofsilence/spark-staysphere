'use client';

import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';

const TOTAL = 2;

/** "Step 1 of 2" and the two bars under it — the wizard's own sense of where it is. */
export function StepHeader({ step }: { step: 1 | 2 }) {
  const t = useAdminT();
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{t('signIn.step', { current: step, total: TOTAL })}</p>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, index) => (
          <span key={index} className={cn('h-1 flex-1 rounded-full', index < step ? 'bg-primary' : 'bg-stone')} />
        ))}
      </div>
    </div>
  );
}
