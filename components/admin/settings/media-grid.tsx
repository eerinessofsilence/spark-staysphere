'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { INTL_TAGS } from '@/lib/i18n/locale';
import { pluralForm } from '@/lib/i18n/plural';
import { Modal } from '@/components/site/modal';
import { tag } from '@/lib/ui';
import { ClientPagination, paginateClient } from '@/components/admin/operations/client-pagination';

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

/** "1.2 MB" / "1,2 MB" / "1,2 МБ" — the unit and the decimal separator both follow the locale. */
function formatBytes(bytes: number, locale: AdminLocale): string {
  const mega = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(INTL_TAGS[locale], {
    style: 'unit',
    unit: mega ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: mega ? 1 : 0,
  }).format(mega ? bytes / (1024 * 1024) : Math.max(1, bytes / 1024));
}

export function MediaGrid({ tiles }: { tiles: MediaTile[] }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [openUrl, setOpenUrl] = React.useState<string | null>(null);
  const close = React.useCallback(() => setOpenUrl(null), []);
  const open = tiles.find((tile) => tile.url === openUrl) ?? null;
  const [page, setPage] = React.useState(1);
  const { pageItems: pageTiles, page: currentPage, totalPages } = paginateClient(tiles, page);

  const usedIn = (count: number) =>
    pluralForm(locale, count, {
      one: t('mediaLib.usedInOne', { count }),
      few: t('mediaLib.usedInFew', { count }),
      many: t('mediaLib.usedInMany', { count }),
      other: t('mediaLib.usedInOther', { count }),
    });

  return (
    <>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pageTiles.map((tile) => (
          <li key={tile.url} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpenUrl(tile.url)}
              aria-label={t('mediaLib.open', { filename: tile.filename })}
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
                    <span className={tag()}>{t('mediaLib.unused')}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{usedIn(tile.usage.length)}</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ClientPagination page={currentPage} totalPages={totalPages} total={tiles.length} onPageChange={setPage} />

      <Modal open={open !== null} onClose={close} title={open?.filename ?? t('mediaLib.media')} className="sm:max-w-2xl">
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
                <dt className="text-muted-foreground">{t('mediaLib.dimensions')}</dt>
                <dd className="mt-0.5 font-medium">
                  {open.width} × {open.height}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('mediaLib.fileSize')}</dt>
                <dd className="mt-0.5 font-medium">{formatBytes(open.bytes, locale)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">{t('mediaLib.folder')}</dt>
                <dd className="mt-0.5 truncate font-medium">{open.folderLabel}</dd>
              </div>
            </dl>
            <p className="truncate rounded-2xl bg-stone/60 px-4 py-2.5 text-xs text-muted-foreground">
              <code>{open.url}</code>
            </p>
            <div>
              <p className="text-sm font-medium">{t('mediaLib.whereUsed')}</p>
              {open.usage.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{t('mediaLib.notUsedAnywhere')}</p>
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
