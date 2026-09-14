import type { Metadata } from 'next';
import { contentService } from '@/lib/application/container';
import { formatMoney, viewLabels } from '@/lib/formatting';
import { tag } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { BrandSettings, type BrandPreviewRoom } from '@/components/admin/settings/brand-settings';

export const metadata: Metadata = { title: 'Brand & domain — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function BrandSettingsPage() {
  const [{ hotel }, rooms] = await Promise.all([
    contentService.getHotelContent(),
    contentService.listRoomsContent(),
  ]);

  const room = rooms.find((candidate) => !candidate.hidden && candidate.media.some((item) => item.type === 'image'));
  const cover = room?.media.find((item) => item.type === 'image');
  const rates = room ? await contentService.listRatesContent(room.id) : [];

  const preview: BrandPreviewRoom | null =
    room && cover
      ? {
          roomName: room.name,
          view: viewLabels[room.view],
          price: formatMoney(rates[0]?.nightlyPrice ?? 0, hotel.currency),
          photoUrl: cover.url,
          photoWidth: cover.width ?? 1600,
          photoHeight: cover.height ?? 1067,
        }
      : null;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Brand & domain"
        description="How the booking site looks, where it lives, and who guest emails come from."
        actions={<span className={tag()}>Preview — changes aren't saved in this demo</span>}
      />
      <BrandSettings
        hotel={{ name: hotel.name, tagline: hotel.tagline, location: hotel.location, currency: hotel.currency }}
        preview={preview}
      />
    </AdminPage>
  );
}
