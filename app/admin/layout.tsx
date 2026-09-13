import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { AdminShell } from '@/components/admin/shell/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const hotel = await catalogService.getHotel(DEMO_HOTEL_SLUG);
  return (
    <AdminShell hotelName={hotel.name} location={hotel.location}>
      {children}
    </AdminShell>
  );
}
