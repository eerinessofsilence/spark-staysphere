'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronUpIcon, GlobeAltIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Image } from '@phosphor-icons/react/dist/ssr';
import type { MediaAsset } from '@/lib/domain/ports';
import { labelFromFilename, mediaTypeOf } from '@/lib/domain/media';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { useFieldErrors } from './content-form';
import { TextInput } from './fields';
import { MediaPicker } from './media-picker';
import { useOrderedList } from './use-ordered-list';
import { PhotoUpload } from './photo-upload';
import { Modal } from '@/components/site/modal';
import { PanoramaViewer } from '@/components/view-360';

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
 * Photos can be uploaded together or selected from the library in batches.
 * Every saved URL is still validated against the media library.
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
  const t = useAdminT();
  /** The 360° view opened from its thumbnail, if any. */
  const [tourUrl, setTourUrl] = React.useState<string | null>(null);
  const { rows, values: items, move, remove, addMany, update: updateRow } = useOrderedList(initial);
  const [uploaded, setUploaded] = React.useState<MediaAsset[]>([]);
  const allAssets = React.useMemo(() => [...new Map([...assets, ...uploaded].map((asset) => [asset.url, asset])).values()], [uploaded, assets]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const byUrl = React.useMemo(() => new Map(allAssets.map((asset) => [asset.url, asset])), [allAssets]);
  const errors = useFieldErrors();
  const listError = errors[name]?.[0];

  function update(index: number, patch: Partial<MediaItemDraft>) {
    updateRow(index, { ...items[index]!, ...patch });
  }
  function addAssets(picked: MediaAsset[]) {
    addMany(picked.map((asset) => ({ type: mediaTypeOf(asset), url: asset.url, label: mediaTypeOf(asset) === '360' ? '360° view' : labelFromFilename(asset.filename) })));
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <PhotoUpload count={items.length} onLibrary={() => setPickerOpen(true)} onUploaded={(added) => {
        setUploaded((current) => [...current, ...added]); addAssets(added);
      }} />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('media.noPhotosCover')}</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map(({ id, value: item }, index) => {
            const asset = byUrl.get(item.url);
            const labelId = `${name}-${index}-label`;
            const rowError = errors[`${name}.${index}.label`]?.[0] ?? errors[`${name}.${index}.url`]?.[0];
            const title = item.label?.trim() ? `“${item.label.trim()}”` : t('media.photoN', { n: index + 1 });
            return (
              <li
                key={id}
                className={cn('grid gap-2 rounded-2xl border p-3', rowError ? 'border-danger/60' : 'border-border')}
              >
                <div className="flex flex-wrap items-center gap-3">
                  {item.type === '360' ? (
                    /* A 360° view is opened, not glanced at: its thumbnail is a
                       button onto the draggable tour itself. */
                    <button
                      type="button"
                      onClick={() => setTourUrl(item.url)}
                      aria-label={t('media.open360', { title })}
                      className="admin-grid-photo bg-ink"
                    >
                      <img src={item.url} alt="" className="size-full object-cover opacity-70" />
                      <span className="absolute inset-0 grid place-items-center text-white">
                        <GlobeAltIcon className="size-6" aria-hidden="true" />
                      </span>
                    </button>
                  ) : (
                  <span className="admin-grid-photo bg-stone">
                    {asset ? (
                      // eslint-disable-next-line -- fixed-size thumbnail, plain img is the convention here (see components/hotel/*).
                      <img src={asset.url} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted-foreground">
                        <Image weight="fill" className="size-5" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  )}
                  <div className="grid min-w-0 flex-1 basis-40 gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label htmlFor={labelId} className="text-xs text-muted-foreground">
                        {index === 0 ? t('media.coverLabel') : t('media.labelFor', { n: index + 1 })}
                      </label>
                      <span className={tag('py-0 text-[11px]')}>{item.type === '360' ? t('media.view360') : t('media.photo')}</span>
                    </div>
                    <TextInput
                      id={labelId}
                      value={item.label ?? ''}
                      onChange={(event) => update(index, { label: event.target.value })}
                      placeholder={t('media.labelPlaceholder')}
                      aria-invalid={rowError ? true : undefined}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
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
                      disabled={index === items.length - 1}
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
                  </div>
                </div>
                {rowError ? (
                  <p role="alert" data-field-error={labelId} className="text-xs font-medium text-danger">
                    {rowError}
                  </p>
                ) : !item.label?.trim() ? (
                  <p className="text-xs text-muted-foreground">{t('media.labelHint')}</p>
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

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={allAssets}
        usedUrls={items.map((item) => item.url)}
        suggestedFolder={suggestedFolder}
        onPick={(asset) => addAssets([asset])}
        onPickMany={addAssets}
        maxSelection={30 - items.length}
      />

      <Modal
        open={tourUrl !== null}
        onClose={() => setTourUrl(null)}
        title={t('media.view360')}
        fullScreen
        className="sm:max-w-4xl"
      >
        <div className="relative h-full min-h-0 w-full overflow-hidden bg-ink sm:aspect-video sm:h-auto">
          {tourUrl ? <PanoramaViewer key={tourUrl} src={tourUrl} title={t('media.view360')} className="absolute inset-0 size-full" /> : null}
        </div>
      </Modal>
    </div>
  );
}
