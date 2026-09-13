import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Chessboard — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function ChessboardPage() {
  return (
    <AdminPage>
      <AdminPageHeader
        title="Chessboard"
        description="Every room, night by night: who is in it, what simulated demand holds, and what is closed to sale."
      />
    </AdminPage>
  );
}
