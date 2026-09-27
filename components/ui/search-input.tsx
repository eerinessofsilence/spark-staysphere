import * as React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Classes for the wrapper, useful when the search field sits in a grid. */
  wrapperClassName?: string;
}

/** One search field shape across guest and admin screens. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className, wrapperClassName, ...props }, ref) {
    return (
      <div className={cn('relative min-w-0', wrapperClassName)}>
        <MagnifyingGlassIcon
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          {...props}
          ref={ref}
          type="search"
          className={cn(fieldClass, 'pl-10', className)}
        />
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
