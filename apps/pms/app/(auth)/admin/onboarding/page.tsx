import Link from 'next/link';
import { getAdminSession } from '@/lib/application/admin-session';
import { getAdminT } from '@/lib/i18n/admin/server';
import { pill } from '@/lib/ui';

export default async function OnboardingPage() {
  const session = await getAdminSession();
  const t = await getAdminT();
  return <div className="mx-auto w-full max-w-sm rounded-[18px] bg-card p-6 shadow-soft sm:p-8">
    <h1 className="text-display text-3xl">{t('onboarding.chooseHeading')}</h1>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('onboarding.chooseBody')}</p>
    <div className="mt-6 grid gap-3">
      {(!session || session.tenantAccount) && <Link href={session ? '/admin/onboarding/create-hotel' : '/admin/sign-up'} className={pill('primary', 'w-full')}>{t('onboarding.createHotelChoice')}</Link>}
      <Link href={session ? '/admin/onboarding/select-hotel' : '/admin/sign-in?next=select-hotel'} className={pill('secondary', 'w-full')}>{t('onboarding.joinHotelChoice')}</Link>
    </div>
  </div>;
}
