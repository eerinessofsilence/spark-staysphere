import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Bookings — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function BookingsPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Bookings" description="Every reservation at the property, with the guest, the room, and what was paid." />
    </AdminPage>
  );
}
