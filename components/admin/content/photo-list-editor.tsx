'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Image } from '@phosphor-icons/react/dist/ssr';
import type { MediaAsset } from '@/lib/domain/ports';
import { iconButton, pill, tag } from '@/lib/ui';
import { useFieldErrors } from './content-form';
import { MediaPicker } from './media-picker';
import { useOrderedList } from './use-ordered-list';

/**
 * An add-on's photos: unlabelled — just a picked set from the media library,
 * in the order they'll appear in the card and the panel's slider. Same shape
 * as `MediaListEditor` without the labels a room's gallery needs.
 */
export function PhotoListEditor({ name, initial, assets }: { name: string; initial: string[]; assets: MediaAsset[] }) {
  const { rows, values: urls, move, remove, add } = useOrderedList(initial);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const byUrl = React.useMemo(() => new Map(assets.map((asset) => [asset.url, asset])), [assets]);
  const errors = useFieldErrors();

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      {urls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {rows.map(({ id, value: url }, index) => {
            const asset = byUrl.get(url);
            const error = errors[`${name}.${index}`]?.[0];
            return (
              <li key={id} className="grid min-w-0 gap-1.5 sm:w-32">
                <span className="relative block aspect-square overflow-hidden rounded-2xl bg-stone">
                  {asset ? (
                    // eslint-disable-next-line -- fixed-size thumbnail, plain img is the convention here (see components/hotel/*).
                    <img src={asset.url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground">
                      <Image weight="fill" className="size-5" aria-hidden="true" />
                    </span>
                  )}
                  {index === 0 ? <span className={tag('absolute top-2 left-2 bg-card/90 py-0.5')}>Cover</span> : null}
                </span>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Show photo ${index + 1} earlier`}
                    className={iconButton('light', 'size-11 sm:size-9')}
                  >
                    <ChevronLeftIcon className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === urls.length - 1}
                    aria-label={`Show photo ${index + 1} later`}
                    className={iconButton('light', 'size-11 sm:size-9')}
                  >
                    <ChevronRightIcon className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove photo ${index + 1}`}
                    className={iconButton('light', 'size-11 sm:size-9')}
                  >
                    <XMarkIcon className="size-4" aria-hidden="true" />
                  </button>
                </div>
                {error ? (
                  <p role="alert" data-field-error="" tabIndex={-1} className="text-xs font-medium text-danger outline-none">
                    {error}
                  </p>
                ) : null}
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
        usedUrls={urls}
        suggestedFolder="dining"
        onPick={(asset) => add(asset.url)}
      />
    </div>
  );
}
