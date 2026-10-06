'use client';

import * as React from 'react';
import type { MediaAsset } from '@/lib/domain/ports';
import { folderLabel, labelFromFilename, mediaTypeOf } from '@/lib/domain/media';
import { Modal } from '@/components/site/modal';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralForm } from '@/lib/i18n/plural';
import { tag, pill } from '@/lib/ui';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';
import { Select } from './fields';
import { SearchInput } from '@/components/ui/search-input';

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  assets: MediaAsset[];
  onPick: (asset: MediaAsset) => void;
  onPickMany?: (assets: MediaAsset[]) => void;
  maxSelection?: number;
  /** Already in this gallery — shown as added and not offered twice. */
  usedUrls?: string[];
  /** The folder to open on, e.g. the room's own photographs. */
  suggestedFolder?: string;
}

/**
 * Pick from committed photos and uploaded assets returned by the media library.
 * No external URL is ever offered. Opens on the room's own folder when it has
 * one, searches by name, and marks what the gallery already holds.
 */
export function MediaPicker({ open, onClose, assets, onPick, onPickMany, maxSelection = 30, usedUrls = [], suggestedFolder }: MediaPickerProps) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const folders = React.useMemo(
    () => [...new Set(assets.map((asset) => asset.folder))].sort((a, b) => a.localeCompare(b)),
    [assets],
  );
  const used = React.useMemo(() => new Set(usedUrls), [usedUrls]);
  // The room's own folder first — unless everything in it is already in the gallery.
  const suggestionHasNew =
    suggestedFolder !== undefined &&
    assets.some((asset) => asset.folder === suggestedFolder && !used.has(asset.url));
  const startFolder = suggestionHasNew ? suggestedFolder : 'all';
  const [folder, setFolder] = React.useState(startFolder);
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setFolder(startFolder);
    setQuery('');
    setSelected([]);
    // Only when the picker opens: re-running as the gallery changes would yank the folder mid-browse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const needle = query.trim().toLowerCase();
  const visible = assets.filter(
    (asset) =>
      (folder === 'all' || asset.folder === folder) &&
      (!needle || asset.filename.toLowerCase().includes(needle) || folderLabel(asset.folder).toLowerCase().includes(needle)),
  );
  const photoCount = `${visible.length} ${pluralForm(locale, visible.length, {
    one: t('media.photoOne'),
    few: t('media.photoFew'),
    many: t('media.photoMany'),
    other: t('media.photoMany'),
  })}`;

  return (
    <Modal open={open} onClose={onClose} title={t(onPickMany ? 'upload.library' : 'media.pick')} className="sm:max-w-3xl">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <label htmlFor="media-picker-search" className="sr-only">
          {t('media.search')}
        </label>
        <SearchInput
          id="media-picker-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          suggestions={assets.filter((asset) => folder === 'all' || asset.folder === folder).map((asset) => ({ value: asset.filename, label: labelFromFilename(asset.filename), detail: folderLabel(asset.folder) }))}
          suggestionsLabel={t('media.search')}
          onSuggestionSelect={(item) => setQuery(item.value)}
          placeholder={t('media.searchPlaceholder')}
          wrapperClassName="min-w-0"
        />
        <label htmlFor="media-picker-folder" className="sr-only">
          {t('media.folder')}
        </label>
        <Select id="media-picker-folder" value={folder} onChange={setFolder}>
          <option value="all">{t('media.allFolders')}</option>
          {folders.map((name) => (
            <option key={name} value={name}>
              {folderLabel(name)}
            </option>
          ))}
        </Select>
      </div>

      <p className="mt-3 mb-3 text-xs text-muted-foreground" aria-live="polite">
        {folder !== 'all' ? t('media.photosIn', { photos: photoCount, folder: folderLabel(folder) }) : photoCount}
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('media.nothingMatches')}{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFolder('all');
            }}
            className="cursor-pointer font-medium text-foreground underline underline-offset-2"
          >
            {t('media.showAll')}
          </button>
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((asset) => {
            const added = used.has(asset.url);
            const checked = selected.includes(asset.url);
            const panorama = mediaTypeOf(asset) === '360';
            const name = labelFromFilename(asset.filename);
            const description = [
              name,
              folderLabel(asset.folder),
              panorama ? t('media.view360') : null,
              added ? t('media.alreadyAdded') : null,
            ]
              .filter((part): part is string => part !== null)
              .join(', ');
            return (
              <li key={asset.url} className="min-w-0">
                <button
                  type="button"
                  disabled={added || Boolean(onPickMany && !checked && selected.length >= maxSelection)}
                  aria-pressed={onPickMany ? checked : undefined}
                  onClick={() => {
                    if (onPickMany) setSelected((current) => checked ? current.filter((url) => url !== asset.url) : [...current, asset.url]);
                    else { onPick(asset); onClose(); }
                  }}
                  aria-label={description}
                  title={asset.filename}
                  className={cn('group relative block w-full cursor-pointer overflow-hidden rounded-[18px] border text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border', checked ? 'border-accent ring-2 ring-accent' : 'border-border')}
                >
                  {checked ? <CheckCircle weight="fill" className="absolute right-2 top-2 z-10 size-6 rounded-full bg-card text-accent-strong" aria-hidden="true" /> : null}
                  <span className="block aspect-[4/3] overflow-hidden bg-stone">
                    <img
                      src={asset.url}
                      alt=""
                      width={asset.width}
                      height={asset.height}
                      loading="lazy"
                      className="size-full object-cover transition-transform group-hover:scale-105 group-disabled:group-hover:scale-100"
                    />
                  </span>
                  <span className="block px-2.5 pt-2 pb-2.5">
                    <span className="block truncate text-xs font-medium">{name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{folderLabel(asset.folder)}</span>
                  </span>
                  {panorama || added ? (
                    <span className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {panorama ? <span className={tag('bg-card/90 py-0.5')}>360°</span> : null}
                      {added ? <span className={tag('bg-card/90 py-0.5')}>{t('media.added')}</span> : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {onPickMany ? <div className="sticky bottom-0 mt-4 flex justify-end border-t border-border bg-card pt-3">
        <button type="button" disabled={selected.length === 0} className={pill('primary')} onClick={() => {
          onPickMany(selected.map((url) => assets.find((asset) => asset.url === url)!).filter(Boolean));
          onClose();
        }}>{t('upload.selected', { count: selected.length })}</button>
      </div> : null}
    </Modal>
  );
}
