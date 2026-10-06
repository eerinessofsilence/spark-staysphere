'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_STAY_NIGHTS, type RatePlan } from '@/lib/domain/schemas';
import { idleFormState, type ContentFormState } from '@/app/admin/content/_lib/form-state';
import { toast } from '@/components/admin/shell/toast';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';

type UpdateAction = (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;

export function RateStayRulesForm({ rate, action }: { rate: RatePlan & { version: number }; action: UpdateAction }) {
  const t = useAdminT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(action, idleFormState);
  const [version, setVersion] = React.useState(rate.version);
  const handledState = React.useRef<ContentFormState>(idleFormState);

  React.useEffect(() => setVersion(rate.version), [rate.version]);
  React.useEffect(() => {
    if (state === handledState.current) return;
    handledState.current = state;
    if (state.status === 'success') {
      if (state.version !== undefined) setVersion(state.version);
      toast.success(state.message);
      router.refresh();
    } else if (state.status === 'error') {
      if (state.version !== undefined) setVersion(state.version);
    }
  }, [state, router]);

  const fields = [
    { name: 'minimumStay', label: t('rates.minimumStay'), value: rate.minimumStay },
    { name: 'maximumStay', label: t('rates.maximumStay'), value: rate.maximumStay },
    { name: 'minimumStayOnArrival', label: t('rates.minimumStayOnArrival'), value: rate.minimumStayOnArrival },
  ] as const;

  return (
    <section id={`stay-rules-${rate.id}`} className="border-t border-border py-5 first:border-t-0">
      <h2 className="text-base font-semibold">{rate.name}</h2>
      <form action={dispatch} className="mt-3">
        <input type="hidden" name="version" value={version} />
        <div role="group" aria-label={t('rates.editRules')} className="grid gap-3 sm:grid-cols-3">
          {fields.map(({ name, label, value }) => (
            <label key={name} className="grid gap-1.5 text-sm">
              <span>{label} <span className="text-muted-foreground">· {t('rates.nightsUnit')}</span></span>
              <input
                name={name}
                type="number"
                min="1"
                max={MAX_STAY_NIGHTS}
                step="1"
                defaultValue={value}
                placeholder={t('rates.noLimit')}
                aria-invalid={state.fieldErrors?.[name]?.length ? true : undefined}
                className="min-h-11 w-full rounded-2xl border border-border bg-card px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {state.fieldErrors?.[name]?.[0] ? <span className="text-xs text-danger">{state.fieldErrors[name][0]}</span> : null}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('rates.rulesHint')}</p>
        {state.status === 'error' ? <p role="alert" className="mt-3 text-sm text-danger">{state.message}</p> : null}
        <button type="submit" disabled={pending} className={pill('primary', 'mt-4')}>{t('ops.save')}</button>
      </form>
    </section>
  );
}
