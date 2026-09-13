'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronUpIcon, PhotoIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { MediaAsset } from '@/lib/domain/ports';
import { iconButton, pill } from '@/lib/ui';
import { Select, TextInput } from './fields';
import { MediaPicker } from './media-picker';

export interface MediaItemDraft {
  type: 'image' | '360';
  url: string;
  label?: string;
}

/**
 * A room's gallery: ordered image/360° entries, each pointing at the media
 * library. Reordering and removal match `OrderedStringList`'s buttons; "Add
 * a photo" opens `MediaPicker` instead of a free-text URL field, since v1
 * has no upload path and every url must resolve in the library.
 */
export function MediaListEditor({
  name,
  initial,
  assets,
}: {
  name: string;
  initial: MediaItemDraft[];
  assets: MediaAsset[];
}) {
  const [items, setItems] = React.useState(initial);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const byUrl = React.useMemo(() => new Map(assets.map((asset) => [asset.url, asset])), [assets]);

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
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item, index) => {
            const asset = byUrl.get(item.url);
            return (
              <li key={`${item.url}-${index}`} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <span className="block size-16 shrink-0 overflow-hidden rounded-xl bg-stone">
                  {asset ? (
                    // eslint-disable-next-line -- fixed-size thumbnail, plain img is the convention here (see components/hotel/*).
                    <img src={asset.url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground">
                      <PhotoIcon className="size-5" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <TextInput
                    value={item.label ?? ''}
                    onChange={(event) => update(index, { label: event.target.value })}
                    placeholder="Label, e.g. Bedroom"
                    aria-label={`Label for photo ${index + 1}`}
                  />
                  <Select
                    value={item.type}
                    onChange={(event) => update(index, { type: event.target.value as MediaItemDraft['type'] })}
                    aria-label={`Type for photo ${index + 1}`}
                  >
                    <option value="image">Photo</option>
                    <option value="360">360° view</option>
                  </Select>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className={iconButton('light', 'size-9')}
                  >
                    <ChevronUpIcon className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                    className={iconButton('light', 'size-9')}
                  >
                    <ChevronDownIcon className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove photo ${index + 1}`}
                    className={iconButton('light', 'size-9')}
                  >
                    <XMarkIcon className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" onClick={() => setPickerOpen(true)} className={pill('secondary', 'self-start')}>
        <PlusIcon className="size-4" aria-hidden="true" />
        Add a photo
      </button>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={assets}
        onPick={(asset) => setItems([...items, { type: 'image', url: asset.url, label: '' }])}
      />
    </div>
  );
}
