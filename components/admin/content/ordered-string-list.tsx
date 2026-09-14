'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { featureIcon } from '@/components/rooms/feature-icon';
import { iconButton } from '@/lib/ui';
import { useFieldErrors } from './content-form';
import { TextInput } from './fields';

/**
 * Rows with up/down/remove — the shared shape for every reorderable string
 * list (`amenities`, `includedServices`): no drag-and-drop library, per the
 * CMS brief. State lives here and serializes into one hidden JSON input the
 * server action reads with `parseJsonList`.
 *
 * Whatever is still typed in the "add" field is saved with the list: a person
 * who types an amenity and presses Save expects it kept, not quietly dropped
 * for want of the + button.
 *
 * `showIcon` surfaces the mark `feature-icon.ts` will actually render for
 * this text on the guest-facing pages — the implicit effect a name has,
 * shown right next to the field it comes from. Imported directly rather than
 * taken as a prop: a Server Component can't pass a plain function to a
 * Client Component across the RSC boundary, and both callers of this list
 * (amenities, a rate's included services) want the same derivation anyway.
 */
export function OrderedStringList({
  name,
  initial,
  addPlaceholder = 'Add an item',
  showIcon = true,
  itemNoun = 'item',
}: {
  name: string;
  initial: string[];
  addPlaceholder?: string;
  showIcon?: boolean;
  /** What one row is, for screen readers: "amenity", "inclusion". */
  itemNoun?: string;
}) {
  const initialJson = JSON.stringify(initial);
  const [items, setItems] = React.useState(initial);
  const [draft, setDraft] = React.useState('');
  const errors = useFieldErrors();
  const errorKey = Object.keys(errors).find((key) => key === name || key.startsWith(`${name}.`));
  const error = errorKey ? errors[errorKey]?.[0] : undefined;
  const noun = itemNoun.charAt(0).toUpperCase() + itemNoun.slice(1);

  // A save hands the saved list back down; take it (and let go of the draft it now includes).
  React.useEffect(() => {
    setItems(JSON.parse(initialJson) as string[]);
    setDraft('');
  }, [initialJson]);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  }

  function remove(index: number) {
    setItems(items.filter((_, candidate) => candidate !== index));
  }

  function add() {
    const value = draft.trim();
    if (!value) return;
    setItems([...items, value]);
    setDraft('');
  }

  const pending = draft.trim();
  const saved = pending ? [...items, pending] : items;

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(saved)} />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item, index) => {
            const RowIcon = showIcon ? featureIcon(item) : null;
            const title = item.trim() ? `“${item.trim()}”` : `${itemNoun} ${index + 1}`;
            return (
              <li key={index} className="flex items-center gap-2">
                {RowIcon ? (
                  <span className="hidden size-9 shrink-0 place-items-center rounded-full bg-stone text-foreground sm:grid">
                    <RowIcon className="size-4" weight="fill" aria-hidden={true} />
                  </span>
                ) : null}
                <TextInput
                  value={item}
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = event.target.value;
                    setItems(next);
                  }}
                  aria-label={`${noun} ${index + 1}`}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${title} up`}
                  className={iconButton('light', 'size-11 sm:size-9')}
                >
                  <ChevronUpIcon className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`Move ${title} down`}
                  className={iconButton('light', 'size-11 sm:size-9')}
                >
                  <ChevronDownIcon className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${title}`}
                  className={iconButton('light', 'size-11 sm:size-9')}
                >
                  <XMarkIcon className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <TextInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={addPlaceholder}
          aria-label={addPlaceholder}
          className="min-w-0 flex-1"
        />
        <button type="button" onClick={add} aria-label={`Add ${itemNoun}`} className={iconButton('dark', 'size-11 sm:size-9')}>
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p role="alert" data-field-error="" tabIndex={-1} className="text-xs font-medium text-danger outline-none">
          {error}
        </p>
      ) : null}
    </div>
  );
}
