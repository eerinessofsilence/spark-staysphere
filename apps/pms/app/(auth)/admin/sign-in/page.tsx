import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminMember, getAdminSession } from '@/lib/application/admin-session';
import { adminAuthConfig } from '@/lib/application/container';
import { demoMembers } from '@/lib/application/team-directory';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { StepHeader } from '../step-header';
import { SignInForm } from './sign-in-form';
import Link from 'next/link';
import { pill } from '@/lib/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('signIn.title')) };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Already in: straight on to wherever they were headed, never a second door.
  const session = await getAdminSession();
  if (session) {
    const member = await getAdminMember();
    if (session.tenantAccount) redirect(session.onboarded ? '/admin' : '/admin/onboarding');
    if (member?.role === 'Housekeeper') redirect('/housekeeper');
    if (member?.role === 'Hotelier') redirect('/admin/maintenance');
    redirect(session.onboarded ? '/admin' : '/admin/welcome');
  }

  const t = await getAdminT();
  const { demo, password } = adminAuthConfig();

  const nextParam = (await searchParams).next;
  const next = nextParam === 'select-hotel' || nextParam === 'create-hotel' ? nextParam : undefined;
  return (
    <div className="mx-auto w-full max-w-sm rounded-[18px] bg-card p-6 shadow-soft sm:p-8">
      <StepHeader step={1} />
      <h1 className="text-display mt-6 text-3xl">{t('signIn.heading')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('signIn.body')}</p>
      <div className="mt-6">
        {/* The demo credentials are shown only while they are the ones in force — see `adminAuthConfig`. */}
        <SignInForm demo={demo ? { email: demoMembers[0]!.email, password } : null} next={next} />
      </div>
      <Link href="/admin/sign-up" className={pill('ghost', 'mt-3 w-full')}>{t('signIn.createAccount')}</Link>
    </div>
  );
}
