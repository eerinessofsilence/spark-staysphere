import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { SignUpForm } from './sign-up-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('signup.title')) };
}

export default async function SignUpPage() {
  if (await getAdminSession()) redirect('/admin/onboarding');
  const t = await getAdminT();
  return <div className="mx-auto w-full max-w-sm rounded-[18px] bg-card p-6 shadow-soft sm:p-8">
    <h1 className="text-display text-3xl">{t('signup.title')}</h1>
    <p className="mt-2 text-sm text-muted-foreground">{t('onboarding.chooseBody')}</p>
    <div className="mt-6"><SignUpForm /></div>
  </div>;
}
