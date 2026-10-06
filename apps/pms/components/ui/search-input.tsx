'use client';

import * as React from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Classes for the wrapper, useful when the search field sits in a grid. */
  wrapperClassName?: string;
  /** Context-specific matches shown while a filter query is being entered. */
  suggestions?: SearchSuggestion[];
  suggestionsLabel?: string;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
}

export interface SearchSuggestion {
  /** Text placed in the search field when the suggestion is selected. */
  value: string;
  /** Main suggestion line and the text used to match the typed query. */
  label: string;
  detail?: string;
}

/** One search field shape across guest and admin screens. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className, wrapperClassName, suggestions, suggestionsLabel, onSuggestionSelect, value, defaultValue, onChange, onBlur, onKeyDown, ...props }, ref) {
    const listId = React.useId();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const blurTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    React.useEffect(() => () => clearTimeout(blurTimer.current), []);
    const [internalValue, setInternalValue] = React.useState(String(value ?? defaultValue ?? ''));
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(-1);
    const controlledValue = value !== undefined;
    const searchValue = controlledValue ? String(value ?? '') : internalValue;
    const matches = suggestions && searchValue.trim()
      ? suggestions.filter((item) => `${item.value} ${item.label} ${item.detail ?? ''}`.toLocaleLowerCase().includes(searchValue.trim().toLocaleLowerCase())).slice(0, 8)
      : [];

    React.useEffect(() => {
      if (controlledValue) setInternalValue(String(value ?? ''));
    }, [controlledValue, value]);

    React.useImperativeHandle(ref, () => inputRef.current!, []);

    function choose(item: SearchSuggestion) {
      if (!controlledValue) setInternalValue(item.value);
      onSuggestionSelect?.(item);
      setOpen(false);
      setActive(-1);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (open && matches.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActive((index) => (index + 1) % matches.length);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActive((index) => index <= 0 ? matches.length - 1 : index - 1);
        } else if (event.key === 'Escape') {
          setOpen(false);
          setActive(-1);
        } else if (event.key === 'Enter' && active >= 0) {
          event.preventDefault();
          choose(matches[active]!);
        }
      }
      onKeyDown?.(event);
    }

    function clear() {
      const input = inputRef.current;
      if (!input) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (!controlledValue) setInternalValue('');
      setOpen(false);
      setActive(-1);
      input.focus();
    }

    return (
      <div className={cn('relative min-w-0', wrapperClassName)}>
        <MagnifyingGlassIcon
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          {...props}
          ref={inputRef}
          type="search"
          value={searchValue}
          onChange={(event) => {
            if (!controlledValue) setInternalValue(event.target.value);
            onChange?.(event);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={(event) => {
            clearTimeout(blurTimer.current);
            if (searchValue.trim()) setOpen(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            blurTimer.current = setTimeout(() => { setOpen(false); setActive(-1); }, 120);
            onBlur?.(event);
          }}
          onKeyDown={handleKeyDown}
          role={suggestions ? 'combobox' : props.role}
          aria-autocomplete={suggestions ? 'list' : props['aria-autocomplete']}
          aria-expanded={suggestions ? open && matches.length > 0 : props['aria-expanded']}
          aria-controls={suggestions ? [listId, props['aria-controls']].filter(Boolean).join(' ') : props['aria-controls']}
          aria-activedescendant={suggestions && active >= 0 ? `${listId}-option-${active}` : props['aria-activedescendant']}
          className={cn(fieldClass, 'pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none', className)}
        />
        {searchValue ? (
          <button
            type="button"
            disabled={props.disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-stone text-muted-foreground transition-colors hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        {suggestions && open && matches.length > 0 ? (
          <div id={listId} role="listbox" aria-label={suggestionsLabel} className="absolute top-full left-0 z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft">
            {matches.map((item, index) => (
              <button
                key={`${item.value}-${index}`}
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={active === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                className={cn('flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none', active === index ? 'bg-stone text-foreground' : 'hover:bg-stone/70')}
              >
                <span className="min-w-0"><span className="block truncate font-medium">{item.label}</span>{item.detail ? <span className="block truncate text-xs text-muted-foreground">{item.detail}</span> : null}</span>
                {item.value !== item.label ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.value}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
