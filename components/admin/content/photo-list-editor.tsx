'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Image } from '@phosphor-icons/react/dist/ssr';
import type { MediaAsset } from '@/lib/domain/ports';
import { iconButton, pill } from '@/lib/ui';
import { MediaPicker } from './media-picker';

/**
 * An add-on's photos: unlabelled, unordered-by-type — just a picked set from
 * the media library, in the order they'll appear in the card and the panel's
 * slider. Same shape as `MediaListEditor` without the label/type fields a
 * room's gallery needs.
 */
export function PhotoListEditor({ name, initial, assets }: { name: string; initial: string[]; assets: MediaAsset[] }) {
  const [urls, setUrls] = React.useState(initial);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const byUrl = React.useMemo(() => new Map(assets.map((asset) => [asset.url, asset])), [assets]);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= urls.length) return;
    const next = [...urls];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setUrls(next);
  }

  function remove(index: number) {
    setUrls(urls.filter((_, candidate) => candidate !== index));
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      {urls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {urls.map((url, index) => {
            const asset = byUrl.get(url);
            return (
              <li key={`${url}-${index}`} className="grid w-28 gap-1.5">
                <span className="block aspect-square overflow-hidden rounded-2xl bg-stone">
                  {asset ? (
                    // eslint-disable-next-line -- fixed-size thumbnail, plain img is the convention here (see components/hotel/*).
                    <img src={asset.url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground">
                      <Image weight="fill" className="size-5" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className={iconButton('light', 'size-8')}
                  >
                    <ChevronUpIcon className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === urls.length - 1}
                    aria-label="Move down"
                    className={iconButton('light', 'size-8')}
                  >
                    <ChevronDownIcon className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove photo ${index + 1}`}
                    className={iconButton('light', 'size-8')}
                  >
                    <XMarkIcon className="size-3.5" aria-hidden="true" />
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
        onPick={(asset) => setUrls([...urls, asset.url])}
      />
    </div>
  );
}
