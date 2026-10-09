import type { Metadata } from 'next';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { AdminPage } from '@/components/admin/shell/admin-page';
import { ChannelManagerView } from '@/components/admin/channel-manager/channel-manager-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.channelManager')) };
}

export const dynamic = 'force-dynamic';

export default async function ChannelManagerPage() {
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const rooms = await hotelRepository.listRooms(hotel.id);
  const rates = await Promise.all(rooms.map((room) => hotelRepository.listRatePlans(room.id)));

  return (
    <AdminPage>
      <ChannelManagerView roomTypeCount={rooms.length} rateCount={rates.flat().length} />
    </AdminPage>
  );
}
