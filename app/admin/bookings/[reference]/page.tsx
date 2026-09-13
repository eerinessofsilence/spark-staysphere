import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Booking — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function BookingDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return (
    <AdminPage>
      <AdminPageHeader title={reference} />
    </AdminPage>
  );
}
