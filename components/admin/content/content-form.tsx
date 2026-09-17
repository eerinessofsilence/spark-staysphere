'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Warning } from '@phosphor-icons/react/dist/ssr';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { idleFormState, type ContentFormState } from '@/app/admin/content/_lib/form-state';
import { discardUnsavedChanges, useUnsavedChanges } from '@/components/admin/shell/unsaved-changes';
import { toast } from '@/components/admin/shell/toast';
import { announceVersion, useSharedVersion } from './version-channel';

const FieldErrorsContext = React.createContext<Record<string, string[]>>({});

/** Every error the last save returned, keyed by path: `name`, `media.1.url`, `areas.pool.name`. */
export function useFieldErrors(): Record<string, string[]> {
  return React.useContext(FieldErrorsContext);
}

/** A field's own error, or the first error on anything nested under it. */
export function useFieldError(name: string): string | undefined {
  const errors = React.useContext(FieldErrorsContext);
  const own = errors[name]?.[0];
  if (own) return own;
  const nested = Object.keys(errors).find((key) => key.startsWith(`${name}.`));
  return nested ? errors[nested]?.[0] : undefined;
}

interface ContentFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  /** The version this form was loaded with. */
  initialVersion: number;
  children: React.ReactNode;
  submitLabel?: string;
  onSuccess?: (state: ContentFormState) => void;
  /** A delete button or a secondary link, shown beside Save. */
  extraActions?: React.ReactNode;
  /** Clears the fields after each successful save — for a form that adds one item after another. */
  resetOnSuccess?: boolean;
  /**
   * Shared with other controls on the page that write the same entity (`room:<id>`), so their
   * saves move this form's version along instead of turning its next save into a false conflict.
   */
  versionKey?: string;
  /**
   * Docks the action row to the bottom edge of the viewport, centred, on a
   * frosted strip (`.glass-bar`, the page-level cousin of `.glass`). Only for
   * a page's one primary form: a room type page's own
   * `ContentForm` docks, but the rate `ContentForm` repeated once per rate
   * beneath it does not, or every rate on the page would float its own
   * "Save" pill stacked on top of the last.
   */
  dock?: boolean;
  /**
   * Skips the sticky card (border, background, shadow) around the action
   * row — for a form already sitting inside its own card, like a `Modal`,
   * where that framing would just double up.
   */
  bare?: boolean;
}

/** What the form holds, minus its version — compared against the last saved state to know it changed. */
function snapshot(form: HTMLFormElement | null): string | null {
  if (!form) return null;
  const parts: string[] = [];
  for (const [key, value] of new FormData(form)) {
    parts.push(`${key}=${typeof value === 'string' ? value : value.name}`);
  }
  return parts.join('&');
}

/** Opens anything folded around the first error, brings it to the middle of the screen and focuses it. */
function revealFirstError(form: HTMLFormElement | null, banner: HTMLElement | null) {
  requestAnimationFrame(() => {
    const fieldError = form?.querySelector<HTMLElement>('[data-field-error]') ?? null;
    const target = fieldError ?? banner;
    if (!target) return;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    const controlId = fieldError?.dataset.fieldError;
    const control = controlId ? document.getElementById(controlId) : null;
    (control ?? target).focus({ preventScroll: true });
  });
}

/**
 * The shell every CMS form shares.
 *
 * It submits through `useActionState` from its own submit handler rather than `<form action>`:
 * React resets every uncontrolled field once a form action finishes, which after a failed save
 * wiped what had just been typed and put the old value back under the new error.
 *
 * Changes are measured, not guessed: the form's values are compared with the last saved state,
 * so reordering a list, picking from a select or a switch counts as much as typing does. While
 * anything is unsaved the form says so beside its button, warns on reload, and the admin shell
 * asks before a link leaves the page. The button bar sticks to the bottom of the screen while
 * the form is on it, so a long form never hides where to save or what the save did.
 */
export function ContentForm({
  action,
  initialVersion,
  children,
  submitLabel = 'Save changes',
  onSuccess,
  extraActions,
  resetOnSuccess = false,
  versionKey,
  dock = false,
  bare = false,
}: ContentFormProps) {
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const bannerRef = React.useRef<HTMLDivElement>(null);
  const [state, dispatch, isPending] = useActionState(action, idleFormState);
  const [version, setVersion] = useSharedVersion(versionKey, initialVersion);
  const [fieldsKey, setFieldsKey] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const baseline = React.useRef<string | null>(null);
  const submittedWith = React.useRef(initialVersion);
  const handledState = React.useRef(state);
  const leaving = React.useRef(false);
  // Until React attaches the submit handler, the browser would submit natively — a GET that reloads the
  // page with every field in the URL. `<form action>` used to block that; the button now waits instead,
  // and only turns on once the saved state below has been read, so an enabled Save means edits are tracked.
  const [ready, setReady] = React.useState(false);

  const checkDirty = React.useCallback(() => {
    if (baseline.current === null) return;
    setDirty(snapshot(formRef.current) !== baseline.current);
  }, []);

  // The saved state is read once the fields — and the hidden inputs list editors write — are on the page.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      baseline.current = snapshot(formRef.current);
      setDirty(false);
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [fieldsKey]);

  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(checkDirty);
    };
    // Typing fires input events. List editors and the shared Select write hidden inputs from React
    // state, which fires nothing, so those attribute changes are watched; the Select's options open
    // in a portal outside the form, so any click or key anywhere re-checks as well.
    const observer = new MutationObserver(schedule);
    observer.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['value', 'aria-checked', 'data-checked'],
    });
    form.addEventListener('input', schedule);
    form.addEventListener('change', schedule);
    document.addEventListener('pointerup', schedule);
    document.addEventListener('keyup', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      form.removeEventListener('input', schedule);
      form.removeEventListener('change', schedule);
      document.removeEventListener('pointerup', schedule);
      document.removeEventListener('keyup', schedule);
    };
  }, [checkDirty]);

  useUnsavedChanges(formId, dirty);

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  React.useEffect(() => {
    if (state === handledState.current) return;
    handledState.current = state;
    if (state.status === 'success') {
      if (state.version !== undefined) {
        announceVersion(versionKey, submittedWith.current, state.version);
        setVersion(state.version);
      }
      if (resetOnSuccess) {
        setFieldsKey((key) => key + 1);
      } else {
        baseline.current = snapshot(formRef.current);
        setDirty(false);
      }
      onSuccess?.(state);
      toast.success(state.message || 'Saved.');
    } else if (state.status === 'error') {
      toast.error('Not saved. Check the form and try again.');
      revealFirstError(formRef.current, bannerRef.current);
    }
    // Runs once per submit result, not per render: `state` is a fresh object each dispatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const submit = (formData: FormData, withVersion: number) => {
    formData.set('version', String(withVersion));
    submittedWith.current = withVersion;
    React.startTransition(() => dispatch(formData));
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(new FormData(event.currentTarget), version);
  };

  const keepMine = () => {
    if (!formRef.current || state.version === undefined) return;
    setVersion(state.version);
    submit(new FormData(formRef.current), state.version);
  };

  const loadLatest = () => {
    leaving.current = true;
    discardUnsavedChanges();
    window.location.reload();
  };

  const errorCount = Object.keys(state.fieldErrors ?? {}).length;
  let statusText = '';
  let statusTone: 'muted' | 'danger' | 'success' = 'muted';
  let offerJump = false;
  if (isPending) {
    statusText = 'Saving…';
  } else if (state.status === 'error') {
    statusTone = 'danger';
    offerJump = true;
    statusText =
      errorCount > 0
        ? `Not saved — ${errorCount === 1 ? '1 field needs' : `${errorCount} fields need`} attention.`
        : 'Not saved — see the message at the top of the form.';
  } else if (dirty) {
    statusText = 'Unsaved changes';
  } else if (state.status === 'success') {
    statusTone = 'success';
    // The full message goes out as a toast; beside the button a short word is enough.
    statusText = 'Saved';
  }

  return (
    <FieldErrorsContext.Provider value={state.fieldErrors ?? {}}>
      <form ref={formRef} onSubmit={onSubmit} noValidate>
        {state.status === 'error' ? (
          <div
            ref={bannerRef}
            role="alert"
            tabIndex={-1}
            className="mb-6 grid gap-3 rounded-3xl border border-danger/30 bg-danger/10 p-4 outline-none"
          >
            <p className="flex items-start gap-3 text-sm font-medium">
              <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
              {state.message}
            </p>
            {state.conflict ? (
              <div className="flex flex-wrap gap-2 sm:pl-8">
                <button type="button" onClick={keepMine} disabled={isPending} className={pill('primary')}>
                  Save my version
                </button>
                <button type="button" onClick={loadLatest} className={pill('secondary')}>
                  Discard mine and load theirs
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <React.Fragment key={fieldsKey}>{children}</React.Fragment>

        {(() => {
          const statusParagraph = (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm font-medium',
                statusTone === 'danger' && 'text-danger',
                statusTone === 'success' && 'text-success',
                statusTone === 'muted' && 'text-muted-foreground',
              )}
            >
              {statusText === 'Unsaved changes' ? (
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              ) : null}
              {statusText}
              {offerJump ? (
                <button
                  type="button"
                  onClick={() => revealFirstError(formRef.current, bannerRef.current)}
                  className="cursor-pointer underline underline-offset-2"
                >
                  Show me
                </button>
              ) : null}
            </p>
          );

          return dock ? (
            <>
              {/* Reserves the strip's own height so the last field never rides under it. */}
              <div aria-hidden="true" className="h-24" />
              <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 lg:pl-[calc(17.5rem+1.5rem)]">
                {/* Sized to what it holds, not stretched to a 672px strip: a
                    frosted capsule around the button, a few pixels of glass on
                    each side. The status line sits inside only once it has
                    something to say — empty, it takes no room and cancels the
                    gap, but stays mounted so the live region still announces. */}
                <div className="glass-bar pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-full p-1.5 [&>[role=status]]:pr-3 [&>[role=status]]:pl-1 [&>[role=status]:empty]:-ml-2 [&>[role=status]:empty]:p-0">
                  <button type="submit" disabled={isPending || !ready} className={pill('primary')}>
                    {isPending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                    {submitLabel}
                  </button>
                  {extraActions}
                  {statusParagraph}
                </div>
              </div>
            </>
          ) : (
            <div
              className={cn(
                'mt-8 flex flex-wrap items-center gap-x-4 gap-y-2',
                bare ? 'pr-4' : 'sticky bottom-3 z-20 rounded-3xl border border-border bg-card/90 p-2 pr-4 shadow-soft backdrop-blur-md',
              )}
            >
              <button type="submit" disabled={isPending || !ready} className={pill('primary')}>
                {isPending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                {submitLabel}
              </button>
              {extraActions}
              {statusParagraph}
            </div>
          );
        })()}
      </form>
    </FieldErrorsContext.Provider>
  );
}
