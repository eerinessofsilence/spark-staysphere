import type { ComponentProps } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';

type NativeSelectProps = ComponentProps<'select'> & { wrapperClassName?: string };

/** A native select with a consistently positioned interface chevron. */
export function NativeSelect({ className, wrapperClassName, children, ...props }: NativeSelectProps) {
  return (
    <span className={cn('relative block min-w-0', wrapperClassName)}>
      <select {...props} className={cn(fieldClass, 'appearance-none pr-10', className)}>
        {children}
      </select>
      <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}
