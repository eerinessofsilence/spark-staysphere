'use client';

import * as React from 'react';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';
import {
  Select as BaseSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-muted-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {error && error.trim() ? (
        // `data-field-error` names the control, so a failed save can bring this field into view and focus it.
        <p role="alert" data-field-error={id} className="mt-1.5 text-xs font-medium text-danger">
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

interface SelectProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /** `<option>` elements, the same shape a native `<select>` takes. */
  children: React.ReactNode;
  onChange?: (value: string) => void;
}

/**
 * The CMS's `<select>`, built on the branded `components/ui/select.tsx`
 * (Base UI) rather than the browser's own control — so it can carry the
 * product's chrome and stay a pill-cornered, focus-ringed field like every
 * other input, not the OS's native dropdown. Options are still authored as
 * `<option>` children so call sites read like a native select; this reads
 * them back into the `items` the trigger needs to show the selected label.
 */
export function Select({
  id,
  name,
  value,
  defaultValue,
  required,
  disabled,
  className,
  'aria-label': ariaLabel,
  children,
  onChange,
}: SelectProps) {
  const options = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    return [
      {
        value: String(child.props.value),
        label: child.props.children,
        disabled: child.props.disabled,
      },
    ];
  });

  return (
    <BaseSelect
      items={options}
      name={name}
      value={value}
      defaultValue={defaultValue}
      required={required}
      disabled={disabled}
      onValueChange={onChange ? (next) => onChange(next ?? '') : undefined}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(fieldClass, 'justify-between gap-2 py-0', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </BaseSelect>
  );
}
