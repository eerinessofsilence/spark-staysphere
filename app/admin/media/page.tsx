import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpTrayIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { MediaGrid, type MediaTile, type MediaUsage } from '@/components/admin/settings/media-grid';

export const metadata: Metadata = { title: 'Media library — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

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
    use(area.photo.url, { label: `Hotel · ${area.name} photo`, href: '/admin/content/hotel' });
    use(area.panorama, { label: `Hotel · ${area.name} 360° view`, href: '/admin/content/hotel' });
  }
  for (const room of rooms) {
    for (const item of room.media) {
      const what = item.label ?? (item.type === '360' ? '360° view' : 'Photo');
      use(item.url, { label: `${room.name} · ${what}`, href: `/admin/content/rooms/${room.id}` });
    }
  }
  for (const addOn of addOns) {
    addOn.photos?.forEach((photo, index) =>
      use(photo.url, { label: `${addOn.name} · photo ${index + 1}`, href: `/admin/content/add-ons/${addOn.id}` }),
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

  return (
    <AdminPage>
      <AdminPageHeader
        title="Media library"
        actions={
          <button type="button" disabled className={pill('secondary')}>
            <ArrowUpTrayIcon className="size-4" aria-hidden="true" />
            Upload
          </button>
        }
      />
      <p className="text-sm text-muted-foreground">
        Uploads arrive with media storage. For now the library is the photography committed to the site.
      </p>

      <nav
        aria-label="Folders"
        className="mt-8 flex gap-2 overflow-x-auto pb-1 contain-inline-size sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        <Link
          href="/admin/media"
          aria-current={folder === null ? 'page' : undefined}
          className={pill(folder === null ? 'primary' : 'secondary', 'shrink-0')}
        >
          All <span className="font-normal opacity-70">{assets.length}</span>
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
        <div className="mt-6 flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
          <PhotoIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-display text-2xl">Nothing in this folder</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              There are no files in “{requested}”. Pick another folder or see everything.
            </p>
          </div>
          <Link href="/admin/media" className={pill('primary')}>
            Show all media
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {tiles.length === 1 ? '1 file' : `${tiles.length} files`}
            {folder ? ` in ${folderLabel(folder)}` : ''}
            {unused > 0 ? `, ${unused} not used anywhere yet` : ', all in use'}.
          </p>
          <MediaGrid tiles={tiles} />
        </>
      )}
    </AdminPage>
  );
}
