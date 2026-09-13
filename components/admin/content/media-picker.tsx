'use client';

import * as React from 'react';
import type { MediaAsset } from '@/lib/domain/ports';
import { Modal } from '@/components/site/modal';
import { Select } from './fields';

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  assets: MediaAsset[];
  onPick: (asset: MediaAsset) => void;
}

/**
 * The whole upload path in v1: pick from `public/images/**`, read at build
 * time into `media-manifest.generated.json` (see `scripts/generate-media-manifest.mjs`).
 * No external URL is ever offered.
 */
export function MediaPicker({ open, onClose, assets, onPick }: MediaPickerProps) {
  const folders = React.useMemo(
    () => [...new Set(assets.map((asset) => asset.folder))].sort((a, b) => a.localeCompare(b)),
    [assets],
  );
  const [folder, setFolder] = React.useState('all');
  const visible = folder === 'all' ? assets : assets.filter((asset) => asset.folder === folder);

  return (
    <Modal open={open} onClose={onClose} title="Pick a photo">
      <div role="group" aria-label="Filter by folder" className="mb-4">
        <label htmlFor="media-picker-folder" className="sr-only">
          Folder
        </label>
        <Select id="media-picker-folder" value={folder} onChange={(event) => setFolder(event.target.value)}>
          <option value="all">All folders</option>
          {folders.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos in this folder.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((asset) => (
            <li key={asset.url}>
              <button
                type="button"
                onClick={() => {
                  onPick(asset);
                  onClose();
                }}
                className="group block w-full overflow-hidden rounded-2xl border border-border text-left transition-colors hover:border-accent"
              >
                <span className="block aspect-[4/3] overflow-hidden bg-stone">
                  <img
                    src={asset.url}
                    alt=""
                    width={asset.width}
                    height={asset.height}
                    loading="lazy"
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                </span>
                <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">{asset.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
