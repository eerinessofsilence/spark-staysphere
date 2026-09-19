import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpTrayIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { pluralForm } from '@/lib/i18n/plural';
import { pill } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { MediaGrid, type MediaTile, type MediaUsage } from '@/components/admin/settings/media-grid';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('mediaLib.title')) };
}

/** A folder path is the library's own data — `rooms/deluxe` reads as "Rooms · Deluxe" in every language. */
function folderLabel(folder: string): string {
  return folder
    .split('/')
    .map((part) => part.replace(/-/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' · ');
}

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.folder) ? params.folder[0] : params.folder;
  const locale = await getAdminLocale();
  const t = adminT(locale);

  const [{ hotel }, rooms, addOns] = await Promise.all([
    contentService.getHotelContent(),
    contentService.listRoomsContent(),
    contentService.listAddOnsContent(),
  ]);
  const assets = contentService.listMedia();

  const usage = new Map<string, MediaUsage[]>();
  const use = (url: string | undefined, entry: MediaUsage) => {
    if (!url) return;
    usage.set(url, [...(usage.get(url) ?? []), entry]);
  };
  for (const area of hotel.areas) {
    use(area.photo.url, { label: t('mediaLib.usageHotelPhoto', { area: area.name }), href: '/admin/content/hotel' });
    use(area.panorama, { label: t('mediaLib.usageHotelPanorama', { area: area.name }), href: '/admin/content/hotel' });
  }
  for (const room of rooms) {
    for (const item of room.media) {
      const what = item.label ?? (item.type === '360' ? t('mediaLib.panorama') : t('mediaLib.photo'));
      use(item.url, {
        label: t('mediaLib.usageRoomMedia', { room: room.name, what }),
        href: `/admin/content/rooms/${room.id}`,
      });
    }
  }
  for (const addOn of addOns) {
    addOn.photos?.forEach((photo, index) =>
      use(photo.url, {
        label: t('mediaLib.usageAddOnPhoto', { addOn: addOn.name, n: index + 1 }),
        href: `/admin/content/add-ons/${addOn.id}`,
      }),
    );
  }

  const folders = [...new Set(assets.map((asset) => asset.folder))].sort((a, b) => a.localeCompare(b));
  const folder = requested && requested !== 'all' ? requested : null;
  const visible = folder ? assets.filter((asset) => asset.folder === folder) : assets;

  const tiles: MediaTile[] = visible.map((asset) => ({
    url: asset.url,
    filename: asset.filename,
    folder: asset.folder,
    folderLabel: folderLabel(asset.folder),
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    usage: usage.get(asset.url) ?? [],
  }));
  const unused = tiles.filter((tile) => tile.usage.length === 0).length;

  const count = tiles.length;
  const files = pluralForm(locale, count, {
    one: t('mediaLib.filesOne', { count }),
    few: t('mediaLib.filesFew', { count }),
    many: t('mediaLib.filesMany', { count }),
    other: t('mediaLib.filesOther', { count }),
  });
  const scope = folder ? t('mediaLib.filesInFolder', { files, folder: folderLabel(folder) }) : files;
  const tail = unused > 0 ? t('mediaLib.notUsedYet', { count: unused }) : t('mediaLib.allInUse');

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('mediaLib.title')}
        actions={
          <button type="button" disabled className={pill('secondary')}>
            <ArrowUpTrayIcon className="size-4" aria-hidden="true" />
            {t('mediaLib.upload')}
          </button>
        }
      />
      <p className="text-sm text-muted-foreground">{t('mediaLib.body')}</p>

      <nav
        aria-label={t('mediaLib.folders')}
        className="mt-8 flex gap-2 overflow-x-auto pb-1 contain-inline-size sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        <Link
          href="/admin/media"
          aria-current={folder === null ? 'page' : undefined}
          className={pill(folder === null ? 'primary' : 'secondary', 'shrink-0')}
        >
          {t('mediaLib.all')} <span className="font-normal opacity-70">{assets.length}</span>
        </Link>
        {folders.map((name) => (
          <Link
            key={name}
            href={`/admin/media?folder=${encodeURIComponent(name)}`}
            aria-current={folder === name ? 'page' : undefined}
            className={pill(folder === name ? 'primary' : 'secondary', 'shrink-0')}
          >
            {folderLabel(name)}{' '}
            <span className="font-normal opacity-70">{assets.filter((asset) => asset.folder === name).length}</span>
          </Link>
        ))}
      </nav>

      {tiles.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
          <PhotoIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-display text-2xl">{t('mediaLib.emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {t('mediaLib.emptyBody', { folder: requested ?? '' })}
            </p>
          </div>
          <Link href="/admin/media" className={pill('primary')}>
            {t('mediaLib.showAll')}
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">{t('mediaLib.summary', { scope, tail })}</p>
          <MediaGrid tiles={tiles} />
        </>
      )}
    </AdminPage>
  );
}
