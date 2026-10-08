import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { teamService, tenantService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { HotelForm } from '../hotel-form';

export default async function CreateHotelPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-up');
  const member = await teamService.findMemberById(session.memberId);
  const account = member ? await tenantService.findAccount(member.email) : null;
  if (!account) redirect('/admin/onboarding');
  const t = await getAdminT();
  return <div className="mx-auto w-full max-w-sm rounded-[18px] bg-card p-6 shadow-soft sm:p-8">
    <h1 className="text-display text-3xl">{t('onboarding.createHotelHeading')}</h1>
    <div className="mt-6"><HotelForm submissionKey={crypto.randomUUID()} /></div>
  </div>;
}
