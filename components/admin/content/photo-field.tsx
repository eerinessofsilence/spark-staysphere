'use client';

import * as React from 'react';
import { Image } from '@phosphor-icons/react/dist/ssr';
import type { MediaAsset } from '@/lib/domain/ports';
import { pill } from '@/lib/ui';
import { MediaPicker } from './media-picker';

/**
 * One photo, not a list: the hotel's own "about" section shows exactly one
 * image, so `PhotoListEditor`'s reorder arrows would be controls with
 * nothing to do. Same modal, same media library, just a single slot — a
 * bigger preview standing in for a room's small square thumbnail, since here
 * it's the whole picture rather than one of several.
 */
export function PhotoField({ name, initial, assets }: { name: string; initial: string; assets: MediaAsset[] }) {
  const [url, setUrl] = React.useState(initial);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const asset = React.useMemo(() => assets.find((candidate) => candidate.url === url), [assets, url]);

  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_auto] sm:items-center">
      <input type="hidden" name={name} value={url} />
      <span className="block aspect-[4/3] w-full max-w-40 overflow-hidden rounded-2xl bg-stone">
        {asset ? (
          // eslint-disable-next-line -- fixed-size preview, plain img is the convention here (see components/hotel/*).
          <img src={asset.url} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <Image weight="fill" className="size-6" aria-hidden="true" />
          </span>
        )}
      </span>
      <button type="button" onClick={() => setPickerOpen(true)} className={pill('secondary', 'self-start')}>
        {asset ? 'Change photo' : 'Add a photo'}
      </button>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={assets}
        onPick={(picked) => setUrl(picked.url)}
      />
    </div>
  );
}
