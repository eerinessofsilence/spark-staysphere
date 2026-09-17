import { availableHotels, catalogService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { AdminShell } from '@/components/admin/shell/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const selectedSlug = await getSelectedHotelSlug();
  const hotel = await catalogService.getHotel(selectedSlug);
  return (
    <AdminShell hotelName={hotel.name} location={hotel.location} hotels={availableHotels} selectedSlug={selectedSlug}>
      {children}
    </AdminShell>
  );
}
