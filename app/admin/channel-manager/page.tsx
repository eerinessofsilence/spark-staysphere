import type { Metadata } from 'next';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { AdminPage } from '@/components/admin/shell/admin-page';
import { ChannelManagerView } from '@/components/admin/channel-manager/channel-manager-view';

export const metadata: Metadata = { title: 'Channel Manager — Hotel admin | SPARK StaySphere 360' };
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
