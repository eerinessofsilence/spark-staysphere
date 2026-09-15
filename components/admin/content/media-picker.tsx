'use client';

import * as React from 'react';
import type { MediaAsset } from '@/lib/domain/ports';
import { folderLabel, labelFromFilename, mediaTypeOf } from '@/lib/domain/media';
import { Modal } from '@/components/site/modal';
import { fieldClass, tag } from '@/lib/ui';
import { Select } from './fields';

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  assets: MediaAsset[];
  onPick: (asset: MediaAsset) => void;
  /** Already in this gallery — shown as added and not offered twice. */
  usedUrls?: string[];
  /** The folder to open on, e.g. the room's own photographs. */
  suggestedFolder?: string;
}

/**
 * The whole upload path in v1: pick from `public/images/**`, read at build
 * time into `media-manifest.generated.json` (see `scripts/generate-media-manifest.mjs`).
 * No external URL is ever offered. Opens on the room's own folder when it has
 * one, searches by name, and marks what the gallery already holds.
 */
export function MediaPicker({ open, onClose, assets, onPick, usedUrls = [], suggestedFolder }: MediaPickerProps) {
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

  React.useEffect(() => {
    if (!open) return;
    setFolder(startFolder);
    setQuery('');
    // Only when the picker opens: re-running as the gallery changes would yank the folder mid-browse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const needle = query.trim().toLowerCase();
  const visible = assets.filter(
    (asset) =>
      (folder === 'all' || asset.folder === folder) &&
      (!needle || asset.filename.toLowerCase().includes(needle) || folderLabel(asset.folder).toLowerCase().includes(needle)),
  );

  return (
    <Modal open={open} onClose={onClose} title="Pick a photo" className="sm:max-w-3xl">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <label htmlFor="media-picker-search" className="sr-only">
          Search photos
        </label>
        <input
          id="media-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or folder"
          className={fieldClass}
        />
        <label htmlFor="media-picker-folder" className="sr-only">
          Folder
        </label>
        <Select id="media-picker-folder" value={folder} onChange={setFolder}>
          <option value="all">All folders</option>
          {folders.map((name) => (
            <option key={name} value={name}>
              {folderLabel(name)}
            </option>
          ))}
        </Select>
      </div>

      <p className="mt-3 mb-3 text-xs text-muted-foreground" aria-live="polite">
        {visible.length === 1 ? '1 photo' : `${visible.length} photos`}
        {folder !== 'all' ? ` in ${folderLabel(folder)}` : ''}
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing matches.{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFolder('all');
            }}
            className="cursor-pointer font-medium text-foreground underline underline-offset-2"
          >
            Show every photo
          </button>
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((asset) => {
            const added = used.has(asset.url);
            const panorama = mediaTypeOf(asset) === '360';
            const name = labelFromFilename(asset.filename);
            return (
              <li key={asset.url} className="min-w-0">
                <button
                  type="button"
                  disabled={added}
                  onClick={() => {
                    onPick(asset);
                    onClose();
                  }}
                  aria-label={`${name}, ${folderLabel(asset.folder)}${panorama ? ', 360° view' : ''}${added ? ', already added' : ''}`}
                  title={asset.filename}
                  className="group relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-border text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border"
                >
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
                      {added ? <span className={tag('bg-card/90 py-0.5')}>Added</span> : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
