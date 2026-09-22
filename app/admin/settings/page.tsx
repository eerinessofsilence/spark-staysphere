import type { Metadata } from 'next';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lMoney, lView } from '@/lib/i18n/format';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { BrandSettings, type BrandPreviewRoom } from '@/components/admin/settings/brand-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('settings.title')) };
}

export default async function BrandSettingsPage() {
  const locale = await getAdminLocale();
  const t = adminT(locale);
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
          view: lView(room.view, locale),
          price: lMoney(rates[0]?.nightlyPrice ?? 0, hotel.currency, locale),
          photoUrl: cover.url,
          photoWidth: cover.width ?? 1600,
          photoHeight: cover.height ?? 1067,
        }
      : null;

  return (
    <AdminPage>
      <AdminPageHeader title={t('settings.title')} />
      <BrandSettings
        assets={await contentService.listMedia()}
        hotel={{ name: hotel.name, tagline: hotel.tagline, location: hotel.location, currency: hotel.currency }}
        preview={preview}
      />
    </AdminPage>
  );
}
