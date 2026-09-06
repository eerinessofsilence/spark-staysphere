'use client';

import * as React from 'react';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AddOn } from '@/lib/domain/schemas';
import { formatMoney, formatPricingUnit } from '@/lib/formatting';
import { Modal } from '@/components/site/modal';
import { Checkbox } from '@/components/ui/checkbox';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { addOnIcon } from './add-on-icon';

interface AddOnCatalogProps {
  /** One category's extras: the things on sale and the extras hanging off them. */
  addOns: AddOn[];
  /** Every id currently in the stay, extras included. */
  selected: string[];
  /** Called with the whole next selection; the server re-prices from it. */
  onChange: (next: string[]) => void;
  idPrefix?: string;
}

/**
 * The list a guest shops from. A card says only enough to be chosen between —
 * the name, the price, one line of what it is — and opening one gives the
 * photographs, the full description, and the extras that ride along with it.
 *
 * Nothing is priced here. The card shows the catalog price and the panel adds
 * ids to the selection; what a stay costs is always the server's answer.
 */
export function AddOnCatalog({
  addOns,
  selected,
  onChange,
  idPrefix = 'addon',
}: AddOnCatalogProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  const enabled = addOns.filter((addOn) => addOn.enabled);
  const offered = enabled.filter((addOn) => !addOn.parentId);
  const extrasOf = (id: string) => enabled.filter((addOn) => addOn.parentId === id);
  const open = openId ? (offered.find((addOn) => addOn.id === openId) ?? null) : null;

  // A category is one kind of thing throughout: the kitchen sells by sight, the
  // desk sells by description.
  const isMenu = offered.some((addOn) => (addOn.photos?.length ?? 0) > 0);

  return (
    <>
      <ul className={cn('grid gap-4', isMenu ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2')}>
        {offered.map((addOn) => (
          <li key={addOn.id}>
            <AddOnTile
              addOn={addOn}
              added={selected.includes(addOn.id)}
              onOpen={() => setOpenId(addOn.id)}
            />
          </li>
        ))}
      </ul>

      <Modal
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ''}
        // A dish is read across two columns, the photograph running to the
        // panel's own edges. A service has none and keeps the plain chrome at
        // the width of its own text.
        chrome={!open?.photos?.length}
        className={open?.photos?.length ? 'sm:max-w-6xl' : undefined}
      >
        {open ? (
          <AddOnDetails
            key={open.id}
            addOn={open}
            extras={extrasOf(open.id)}
            selected={selected}
            idPrefix={idPrefix}
            onClose={() => setOpenId(null)}
            onCommit={(next) => {
              onChange(next);
              setOpenId(null);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

interface AddOnTileProps {
  addOn: AddOn;
  added: boolean;
  onOpen: () => void;
}

/**
 * A dish photographs; a service does not. Both open the same panel, and both
 * say only what is needed to choose between them — the extras live inside,
 * where they can be read and ticked, not counted from the outside.
 */
function AddOnTile({ addOn, added, onOpen }: AddOnTileProps) {
  const Icon = addOnIcon(addOn.name);
  const cover = addOn.photos?.[0];
  /* Money in the display face, the unit small beside it — the same voice the
     panel and the bill give a price. Set at body size it read as one more
     grey line and the card merged into a single block. */
  const price = (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-display text-base">{formatMoney(addOn.price, addOn.currency)}</span>
      <span className="text-xs text-muted-foreground">
        {formatPricingUnit(addOn.pricingUnit)}
      </span>
    </span>
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${addOn.name}`}
      className={cn(
        'group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[28px] border bg-card text-left transition-colors',
        added ? 'border-ink' : 'border-border hover:bg-stone/50',
      )}
    >
      {cover ? (
        <span className="relative block aspect-[3/2] overflow-hidden bg-stone">
          <img
            src={cover.url}
            alt={addOn.name}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {added ? <AddedBadge className="absolute top-3 left-3" /> : null}
        </span>
      ) : null}

      {/* Two groups, not four evenly spaced lines: what it is and what it
          costs belong together, the description sits apart from them. */}
      <span className="flex flex-1 flex-col gap-3 p-4">
        <span
          className={cn(
            'flex gap-x-3',
            cover ? 'flex-col gap-y-1' : 'flex-wrap items-baseline justify-between gap-y-1',
          )}
        >
          {/* text-display, like the room card's name — same "photograph,
              name, price" pattern, so the name carries the same weight here. */}
          <span className="text-display flex items-center gap-2 text-lg">
            {cover ? null : (
              <Icon
                weight="fill"
                className={cn(
                  'size-5 shrink-0',
                  added ? 'text-accent-strong' : 'text-muted-foreground',
                )}
                aria-hidden="true"
              />
            )}
            {addOn.name}
          </span>
          {price}
        </span>
        <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {addOn.description}
        </span>
        {added && !cover ? <AddedBadge className="mt-1 self-start" /> : null}
      </span>
    </button>
  );
}

function AddedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'glass flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-2 text-xs font-medium',
        className,
      )}
    >
      <CheckIcon className="size-3.5 text-success" aria-hidden="true" />
      In your stay
    </span>
  );
}

/**
 * The dish, photograph by photograph. Same language as the room gallery: one
 * picture at a time, with the arrows and the counter over it.
 */
function PhotoSlider({
  photos,
  name,
  className,
}: {
  photos: NonNullable<AddOn['photos']>;
  name: string;
  className?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const go = (delta: number) =>
    setIndex((current) => (current + delta + photos.length) % photos.length);

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={`${name} photographs`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') go(-1);
        if (event.key === 'ArrowRight') go(1);
      }}
      className={cn('relative overflow-hidden bg-stone', className)}
    >
      {photos.map((photo, position) => (
        <img
          key={photo.url}
          src={photo.url}
          alt={position === index ? name : ''}
          aria-hidden={position !== index}
          width={photo.width}
          height={photo.height}
          decoding="async"
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-500',
            position === index ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}

      {photos.length > 1 ? (
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className={iconButton('glass')}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </button>
          {/* Dots, not "01 / 03": with three photographs the count is not
              worth reading, only the position, and a dot says that without
              asking anyone to do arithmetic. */}
          <span className="glass flex items-center gap-1.5 rounded-full px-3 py-2.5">
            {photos.map((photo, position) => (
              <span
                key={photo.url}
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  position === index ? 'bg-foreground' : 'bg-foreground/25',
                )}
              />
            ))}
          </span>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className={iconButton('glass')}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface AddOnDetailsProps {
  addOn: AddOn;
  extras: AddOn[];
  selected: string[];
  idPrefix: string;
  onClose: () => void;
  onCommit: (next: string[]) => void;
}

/**
 * What the thing actually is, and what can be added to it. A dish leads with
 * its photograph, edge to edge and the full height of the panel, because that
 * is what the guest is choosing between; the words sit beside it. The extras
 * are held as a draft and committed once, so a guest ticking three of them
 * re-prices the stay once rather than three times.
 */
function AddOnDetails({ addOn, extras, selected, idPrefix, onClose, onCommit }: AddOnDetailsProps) {
  const added = selected.includes(addOn.id);
  const photos = addOn.photos ?? [];
  const [draft, setDraft] = React.useState<string[]>(() =>
    extras.filter((extra) => selected.includes(extra.id)).map((extra) => extra.id),
  );

  /** The selection with this thing and everything hanging off it taken out. */
  const withoutThis = selected.filter(
    (id) => id !== addOn.id && !extras.some((extra) => extra.id === id),
  );

  const toggle = (id: string) =>
    setDraft((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const words = (
    <div className={cn('flex flex-col gap-5 sm:gap-6', photos.length > 0 ? 'p-5 sm:p-8' : '')}>
      <div>
        {/* Room for the close button in the corner above it. */}
        <h3 className={cn('text-display text-3xl sm:text-4xl', photos.length > 0 && 'pr-12')}>
          {addOn.name}
        </h3>
        {/* The price is the second thing read, so it gets the display face and
            a size of its own — the same voice the room card and the bill give
            money, not a footnote under the name. */}
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-display text-2xl sm:text-3xl">
            {formatMoney(addOn.price, addOn.currency)}
          </span>
          <span className="text-sm text-muted-foreground">{formatPricingUnit(addOn.pricingUnit)}</span>
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{addOn.description}</p>
      </div>

      {extras.length > 0 ? (
        <div role="group" aria-labelledby={`${idPrefix}-${addOn.id}-extras`}>
          <h4 id={`${idPrefix}-${addOn.id}-extras`} className="text-display text-lg">
            Add to it
          </h4>
          {/* No rules between the rows: the whole row is the target, so it
              needs a shape of its own to fill on hover, and a hairline through
              the middle of that fill only fights it. Spacing separates them. */}
          <ul className="mt-3 grid gap-2">
            {extras.map((extra) => {
              const id = `${idPrefix}-extra-${extra.id}`;
              const picked = draft.includes(extra.id);
              return (
                <li key={extra.id}>
                  {/* A resting surface, not bare text on the panel: these are
                      things to pick, and at rest they had no shape at all —
                      only a hover fill, which says nothing until touched. */}
                  <label
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition-colors',
                      picked ? 'bg-accent-soft ring-1 ring-ink/15' : 'bg-stone/45 hover:bg-stone/80',
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={picked}
                      onCheckedChange={() => toggle(extra.id)}
                      className="mt-0.5 size-5 shrink-0 rounded-full border-ink/25 bg-card"
                    />
                    <span className="flex flex-1 items-start justify-between gap-4">
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium">{extra.name}</span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                          {extra.description}
                        </span>
                      </span>
                      {/* The money stacks: the figure alone on top so it is the
                          heaviest thing in the row, the unit beneath it and
                          quiet. Side by side they read as one grey phrase. */}
                      <span className="shrink-0 text-right">
                        <span className="text-display block text-xl leading-none whitespace-nowrap">
                          +{formatMoney(extra.price, extra.currency)}
                        </span>
                        <span className="mt-1 block text-xs whitespace-nowrap text-muted-foreground">
                          {formatPricingUnit(extra.pricingUnit)}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/*
        * On a phone the sheet is taller than the screen, and the action used to
        * sit at the far end of it: a guest opened a dish and could not see the
        * button that adds it without scrolling past the photograph, the price,
        * and the extras. It rides the bottom edge instead, the way the guest
        * sheet does, and the content scrolls underneath. From `lg` the panel is
        * two columns and the button already ends the right one, so it goes back
        * to sitting in the flow.
        */}
      <div
        className={cn(
          'mt-auto grid gap-3 pt-3',
          photos.length > 0 &&
            'sticky bottom-0 -mx-5 -mb-5 border-t border-border bg-card px-5 pb-5 sm:-mx-8 sm:-mb-8 sm:px-8 sm:pb-8 lg:static lg:m-0 lg:border-t-0 lg:p-0 lg:pt-1',
        )}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCommit([...withoutThis, addOn.id, ...draft])}
            className={pill('primary', 'min-h-12 flex-1 justify-center')}
          >
            {added ? (
              'Save changes'
            ) : (
              <>
                <PlusIcon className="size-4" aria-hidden="true" />
                Add to your stay
              </>
            )}
          </button>
          {added ? (
            <button
              type="button"
              onClick={() => onCommit(withoutThis)}
              className={pill('secondary', 'min-h-12 justify-center')}
            >
              Remove
            </button>
          ) : null}
        </div>
        {/* Every line in a pinned footer costs screen for good, so the phone
            keeps the promise and drops the mechanics. */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="hidden sm:inline">
            Added to the stay and priced by the booking engine.{' '}
          </span>
          Nothing is charged now.
        </p>
      </div>
    </div>
  );

  if (photos.length === 0) return words;

  return (
    <div className="relative grid lg:min-h-[32rem] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="relative">
        <PhotoSlider
          photos={photos}
          name={addOn.name}
          className="aspect-[2/1] sm:aspect-[3/2] lg:absolute lg:inset-0 lg:aspect-auto lg:size-full"
        />
      </div>
      {words}

      {/* The panel has no title bar, but the way out still belongs in the
          corner every other dialog keeps it. Solid rather than frosted: on a
          phone this corner is the photograph, on a desk it is the white
          column, and one button has to read on both. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={iconButton('light', 'absolute top-4 right-4 z-10 shadow-soft')}
      >
        <XMarkIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
