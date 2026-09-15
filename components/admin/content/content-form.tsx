'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Warning } from '@phosphor-icons/react/dist/ssr';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { pill } from '@/lib/ui';
import { idleFormState, type ContentFormState } from '@/app/admin/content/_lib/form-state';

const FieldErrorsContext = React.createContext<Record<string, string[]>>({});

/** A field reads its own error out of the form's last submit result. */
export function useFieldError(name: string): string | undefined {
  const errors = React.useContext(FieldErrorsContext);
  return errors[name]?.[0];
}

interface ContentFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  /** The version this form was loaded with — bumped locally after each successful save. */
  initialVersion: number;
  children: React.ReactNode;
  submitLabel?: string;
  onSuccess?: (state: ContentFormState) => void;
  /** A delete button or a secondary link, shown beside Save. */
  extraActions?: React.ReactNode;
  /**
   * Docks the action row to the bottom edge of the viewport, centred, on a
   * frosted strip (`.glass-bar`, the page-level cousin of `.glass`). Only for
   * a page's one primary form: a room type page's own
   * `ContentForm` docks, but the rate `ContentForm` repeated once per rate
   * beneath it does not, or every rate on the page would float its own
   * "Save" pill stacked on top of the last.
   */
  dock?: boolean;
}

/**
 * The shell every CMS form shares: `useActionState` wiring, the field-error
 * context each `Field` reads from, the conflict/rule-violation banner, the
 * `role="status"` success message, a save button disabled while pending, and
 * a `beforeunload` warning once the form has unsaved changes.
 */
export function ContentForm({
  action,
  initialVersion,
  children,
  submitLabel = 'Save changes',
  onSuccess,
  extraActions,
  dock = false,
}: ContentFormProps) {
  const [state, formAction, isPending] = useActionState(action, idleFormState);
  const [version, setVersion] = React.useState(initialVersion);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (state.status === 'success') {
      setDirty(false);
      if (state.version !== undefined) setVersion(state.version);
      onSuccess?.(state);
    }
    // Runs once per submit result, not per render: `state` is a fresh object each dispatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return (
    <FieldErrorsContext.Provider value={state.fieldErrors ?? {}}>
      <form action={formAction} onChangeCapture={() => setDirty(true)} noValidate>
        <input type="hidden" name="version" value={version} />

        {state.status === 'error' ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-3xl border border-danger/30 bg-danger/10 p-4"
          >
            <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <p className="text-sm font-medium">{state.message}</p>
          </div>
        ) : null}

        {children}

        {dock ? (
          <>
            {/* Reserves the strip's own height so the last field never rides under it. */}
            <div aria-hidden="true" className="h-24" />
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 lg:pl-[calc(17.5rem+1.5rem)]">
              {/* Sized to what it holds, not stretched to a 672px strip: a
                  frosted capsule around the button, a few pixels of glass on
                  each side. The status line sits inside only once it has
                  something to say — empty, it takes no room and cancels the
                  gap, but stays mounted so the live region still announces. */}
              <div className="glass-bar pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-full p-1.5">
                <button type="submit" disabled={isPending} className={pill('primary')}>
                  {isPending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {submitLabel}
                </button>
                {extraActions}
                <p
                  role="status"
                  aria-live="polite"
                  className="pr-3 pl-1 text-sm font-medium text-success empty:-ml-2 empty:p-0"
                >
                  {state.status === 'success' ? state.message : ''}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <button type="submit" disabled={isPending} className={pill('primary')}>
              {isPending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {submitLabel}
            </button>
            {extraActions}
            <p role="status" aria-live="polite" className="text-sm font-medium text-success">
              {state.status === 'success' ? state.message : ''}
            </p>
          </div>
        )}
      </form>
    </FieldErrorsContext.Provider>
  );
}
