'use client';

import * as React from 'react';
import Link from 'next/link';
import { Modal } from '@/components/site/modal';
import { tag } from '@/lib/ui';

export interface MediaUsage {
  label: string;
  href: string;
}

export interface MediaTile {
  url: string;
  filename: string;
  folder: string;
  folderLabel: string;
  width: number;
  height: number;
  bytes: number;
  usage: MediaUsage[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MediaGrid({ tiles }: { tiles: MediaTile[] }) {
  const [openUrl, setOpenUrl] = React.useState<string | null>(null);
  const close = React.useCallback(() => setOpenUrl(null), []);
  const open = tiles.find((tile) => tile.url === openUrl) ?? null;

  return (
    <>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.url} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpenUrl(tile.url)}
              aria-label={`Open ${tile.filename}`}
              className="group block w-full cursor-pointer rounded-[18px] bg-card p-2 text-left shadow-soft transition-colors hover:bg-stone/40"
            >
              <span className="block aspect-[4/3] overflow-hidden rounded-[14px] bg-stone">
                <img
                  src={tile.url}
                  alt=""
                  width={tile.width}
                  height={tile.height}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
              </span>
              <span className="block px-2 pt-2.5 pb-1.5">
                <span className="block truncate text-sm font-medium">{tile.filename}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {tile.width} × {tile.height} · {tile.folderLabel}
                </span>
                <span className="mt-2 block">
                  {tile.usage.length === 0 ? (
                    <span className={tag()}>Unused</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Used in {tile.usage.length === 1 ? '1 place' : `${tile.usage.length} places`}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Modal open={open !== null} onClose={close} title={open?.filename ?? 'Media'} className="sm:max-w-2xl">
        {open ? (
          <div className="grid gap-5">
            <img
              src={open.url}
              alt=""
              width={open.width}
              height={open.height}
              className="max-h-[50vh] w-full rounded-[14px] bg-stone object-contain"
            />
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd className="mt-0.5 font-medium">
                  {open.width} × {open.height}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">File size</dt>
                <dd className="mt-0.5 font-medium">{formatBytes(open.bytes)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Folder</dt>
                <dd className="mt-0.5 truncate font-medium">{open.folderLabel}</dd>
              </div>
            </dl>
            <p className="truncate rounded-2xl bg-stone/60 px-4 py-2.5 text-xs text-muted-foreground">
              <code>{open.url}</code>
            </p>
            <div>
              <p className="text-sm font-medium">Where it's used</p>
              {open.usage.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted-foreground">Not used anywhere yet.</p>
              ) : (
                <ul className="mt-2 grid gap-1">
                  {open.usage.map((use) => (
                    <li key={`${use.href}-${use.label}`}>
                      <Link
                        href={use.href}
                        onClick={close}
                        className="flex min-h-11 items-center rounded-2xl px-3 text-sm hover:bg-stone"
                      >
                        {use.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
