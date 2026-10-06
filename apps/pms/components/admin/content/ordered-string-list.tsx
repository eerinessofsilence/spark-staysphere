'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { featureIcon } from '@/components/rooms/feature-icon';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton } from '@/lib/ui';
import { useFieldErrors } from './content-form';
import { TextInput } from './fields';
import { useOrderedList } from './use-ordered-list';

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
  addPlaceholder,
  showIcon = true,
  itemNoun = 'item',
}: {
  name: string;
  initial: string[];
  /** Already in the team member's language; without one the field says "Add an item" in it. */
  addPlaceholder?: string;
  showIcon?: boolean;
  /**
   * What one row is, for screen readers. The three the CMS has — "item", "amenity",
   * "inclusion" — are translated here; anything else is read out as given.
   */
  itemNoun?: string;
}) {
  const t = useAdminT();
  const { rows, values: items, move, remove, add: addRow, update } = useOrderedList(initial);
  const [draft, setDraft] = React.useState('');
  const errors = useFieldErrors();
  const errorKey = Object.keys(errors).find((key) => key === name || key.startsWith(`${name}.`));
  const error = errorKey ? errors[errorKey]?.[0] : undefined;
  const nounText =
    itemNoun === 'amenity'
      ? t('form.nounAmenity')
      : itemNoun === 'inclusion'
        ? t('form.nounInclusion')
        : itemNoun === 'item'
          ? t('form.nounItem')
          : itemNoun;
  const noun = nounText.charAt(0).toUpperCase() + nounText.slice(1);
  const placeholder = addPlaceholder ?? t('form.addItem');

  // A save hands the saved list back down (via useOrderedList's own effect);
  // let go of the draft it now includes.
  const initialJson = JSON.stringify(initial);
  React.useEffect(() => {
    setDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJson]);

  function add() {
    const value = draft.trim();
    if (!value) return;
    addRow(value);
    setDraft('');
  }

  const pending = draft.trim();
  const saved = pending ? [...items, pending] : items;

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(saved)} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('form.nothingYet')}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row, index) => {
            const RowIcon = showIcon ? featureIcon(row.value) : null;
            const title = row.value.trim() ? `“${row.value.trim()}”` : t('form.itemN', { noun: nounText, n: index + 1 });
            return (
              <li key={row.id} className="flex items-center gap-2">
                {RowIcon ? (
                  <span className="hidden size-9 shrink-0 place-items-center rounded-full bg-stone text-foreground sm:grid">
                    <RowIcon className="size-4" weight="fill" aria-hidden={true} />
                  </span>
                ) : null}
                <TextInput
                  value={row.value}
                  onChange={(event) => update(index, event.target.value)}
                  aria-label={t('form.itemN', { noun, n: index + 1 })}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t('form.moveUp', { title })}
                  className={iconButton('light', 'size-11 sm:size-9')}
                >
                  <ChevronUpIcon className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label={t('form.moveDown', { title })}
                  className={iconButton('light', 'size-11 sm:size-9')}
                >
                  <ChevronDownIcon className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={t('form.removeTitle', { title })}
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
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={add}
          aria-label={t('form.addNoun', { noun: nounText })}
          className={iconButton('dark', 'size-11 sm:size-9')}
        >
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
