'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
            className="mb-6 flex items-start gap-3 rounded-3xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>{state.message}</p>
          </div>
        ) : null}

        {children}

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
      </form>
    </FieldErrorsContext.Provider>
  );
}
