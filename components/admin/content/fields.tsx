'use client';

import * as React from 'react';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { useFieldError } from './content-form';

/**
 * The label + control + error shell every CMS field shares. `role="group"`
 * headings wrap a related set of these (see DESIGN_SYSTEM.md rule 9) — this
 * component is the single field inside one.
 *
 * A client component (not just its callers) so it can read its own error out
 * of `ContentForm`'s field-error context via `name` — the server action's
 * Zod field-error key, which is not always the same as `id` (`id`s are
 * prefixed for uniqueness across repeated rate/media rows; `name` is the raw
 * schema key). This is a Client Component composed as a child of Server
 * Components (the add-on and room pages) and of Client ones (`RateForm`)
 * alike — both are valid without either parent needing to thread the error
 * through itself.
 */
export function Field({
  id,
  name,
  label,
  hint,
  children,
}: {
  id: string;
  /** The Zod field-error key. Defaults to `id` when the two happen to match. */
  name?: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const error = useFieldError(name ?? id);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(fieldClass, 'min-h-24 resize-y py-2.5', props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldClass, props.className)} />;
}
