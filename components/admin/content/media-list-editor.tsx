'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Image } from '@phosphor-icons/react/dist/ssr';
import type { MediaAsset } from '@/lib/domain/ports';
import { labelFromFilename, mediaTypeOf } from '@/lib/domain/media';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { useFieldErrors } from './content-form';
import { TextInput } from './fields';
import { MediaPicker } from './media-picker';

export interface MediaItemDraft {
  type: 'image' | '360';
  url: string;
  label?: string;
}

/**
 * A room's gallery: ordered photos and 360° views, each pointing at the media
 * library. Whether an item is a photo or a 360° view follows from the file
 * picked, so it is shown, not chosen; the label is prefilled from the file
 * name, because guests see it as the name of that view on the room page.
 * "Add a photo" opens `MediaPicker` instead of a free-text URL field, since v1
 * has no upload path and every url must resolve in the library.
 */
export function MediaListEditor({
  name,
  initial,
  assets,
  suggestedFolder,
}: {
  name: string;
  initial: MediaItemDraft[];
  assets: MediaAsset[];
  suggestedFolder?: string;
}) {
  const initialJson = JSON.stringify(initial);
  const [items, setItems] = React.useState(initial);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const byUrl = React.useMemo(() => new Map(assets.map((asset) => [asset.url, asset])), [assets]);
  const errors = useFieldErrors();
  const listError = errors[name]?.[0];

  // A save hands the saved gallery back down; take it, so the next save starts from what is stored.
  React.useEffect(() => {
    setItems(JSON.parse(initialJson) as MediaItemDraft[]);
  }, [initialJson]);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  }

  function update(index: number, patch: Partial<MediaItemDraft>) {
    const next = [...items];
    next[index] = { ...next[index]!, ...patch };
    setItems(next);
  }

  function remove(index: number) {
    setItems(items.filter((_, candidate) => candidate !== index));
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={JSON.stringify(items)} />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet. The first one you add becomes the cover.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item, index) => {
            const asset = byUrl.get(item.url);
            const labelId = `${name}-${index}-label`;
            const rowError = errors[`${name}.${index}.label`]?.[0] ?? errors[`${name}.${index}.url`]?.[0];
            const title = item.label?.trim() ? `“${item.label.trim()}”` : `photo ${index + 1}`;
            return (
              <li
                key={`${item.url}-${index}`}
                className={cn('grid gap-2 rounded-2xl border p-3', rowError ? 'border-danger/60' : 'border-border')}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="block size-16 shrink-0 overflow-hidden rounded-xl bg-stone">
                    {asset ? (
                      // eslint-disable-next-line -- fixed-size thumbnail, plain img is the convention here (see components/hotel/*).
                      <img src={asset.url} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted-foreground">
                        <Image weight="fill" className="size-5" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <div className="grid min-w-0 flex-1 basis-40 gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label htmlFor={labelId} className="text-xs text-muted-foreground">
                        {index === 0 ? 'Cover label' : `Label for photo ${index + 1}`}
                      </label>
                      <span className={tag('py-0 text-[11px]')}>{item.type === '360' ? '360° view' : 'Photo'}</span>
                    </div>
                    <TextInput
                      id={labelId}
                      value={item.label ?? ''}
                      onChange={(event) => update(index, { label: event.target.value })}
                      placeholder="e.g. Bedroom"
                      aria-invalid={rowError ? true : undefined}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
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
                  </div>
                </div>
                {rowError ? (
                  <p role="alert" data-field-error={labelId} className="text-xs font-medium text-danger">
                    {rowError}
                  </p>
                ) : !item.label?.trim() ? (
                  <p className="text-xs text-muted-foreground">Guests see the label as the name of this view.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {listError ? (
        <p role="alert" data-field-error="" tabIndex={-1} className="text-xs font-medium text-danger outline-none">
          {listError}
        </p>
      ) : null}

      <button type="button" onClick={() => setPickerOpen(true)} className={pill('secondary', 'self-start')}>
        <PlusIcon className="size-4" aria-hidden="true" />
        Add a photo
      </button>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={assets}
        usedUrls={items.map((item) => item.url)}
        suggestedFolder={suggestedFolder}
        onPick={(asset) => {
          const type = mediaTypeOf(asset);
          setItems([
            ...items,
            { type, url: asset.url, label: type === '360' ? '360° view' : labelFromFilename(asset.filename) },
          ]);
        }}
      />
    </div>
  );
}
