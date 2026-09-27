import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { teamService } from '@/lib/application/container';

export const dynamic = 'force-dynamic';

export default async function HousekeeperLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');
  const member = await teamService.findMemberById(session.memberId);
  if (!member || member.role !== 'Housekeeper') redirect('/admin');
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
