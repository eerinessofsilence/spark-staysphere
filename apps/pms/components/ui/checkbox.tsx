'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';

import { cn } from '@/lib/utils';
import { CheckIcon } from '@heroicons/react/24/outline';

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative inline-flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground bg-transparent transition-[border-color,background-color,box-shadow] outline-none after:absolute after:-inset-2.5 hover:border-accent hover:shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_12%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-destructive data-checked:border-accent data-checked:bg-accent data-checked:text-accent-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current [&>svg]:size-4.5 [&>svg]:stroke-[3]"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
