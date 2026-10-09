'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { idleFormState, type ContentFormState } from '@/app/admin/content/_lib/form-state';
import { toast } from '@/components/admin/shell/toast';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';

type CloseoutAction = (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;

export function RateCloseoutCell({ action, rateName, date, closed, version, isToday = false }: {
  action: CloseoutAction;
  rateName: string;
  date: string;
  closed: boolean;
  version: number;
  isToday?: boolean;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(action, idleFormState);
  const [ready, setReady] = React.useState(false);
  const [currentClosed, setCurrentClosed] = React.useState(closed);
  const [currentVersion, setCurrentVersion] = React.useState(version);
  const handledState = React.useRef<ContentFormState>(idleFormState);
  const nextClosed = React.useRef(closed);

  React.useEffect(() => setReady(true), []);
  React.useEffect(() => {
    setCurrentClosed(closed);
    setCurrentVersion(version);
  }, [closed, version]);
  React.useEffect(() => {
    if (state === handledState.current) return;
    handledState.current = state;
    if (state.status === 'success') {
      setCurrentClosed(nextClosed.current);
      if (state.version !== undefined) setCurrentVersion(state.version);
      toast.success(state.message);
      router.refresh();
    } else if (state.status === 'error') {
      if (state.version !== undefined) setCurrentVersion(state.version);
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <div data-rate-today={isToday ? 'true' : undefined} className={cn('border-l border-border px-1 py-1 text-center', isToday && 'bg-accent/10')}>
      <form action={dispatch}>
        <input type="hidden" name="version" value={currentVersion} />
        <input type="hidden" name="closed" value={String(!currentClosed)} />
        <button
          type="submit"
          disabled={!ready || pending}
          onClick={() => { nextClosed.current = !currentClosed; }}
          aria-label={`${rateName}, ${date}: ${currentClosed ? t('rates.closed') : t('rates.open')}. ${t('rates.closeOut')}`}
          aria-pressed={currentClosed}
          className={`min-h-10 w-full rounded-full px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${currentClosed ? 'bg-danger/10 text-danger' : 'text-muted-foreground hover:bg-stone hover:text-foreground'}`}
        >
          {currentClosed ? t('rates.closed') : t('rates.open')}
        </button>
      </form>
    </div>
  );
}
