import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { teamService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { StepHeader } from '../step-header';
import { InterestsForm } from './interests-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('welcome.title')) };
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');
  const member = await teamService.findMemberById(session.memberId);
  if (!member) redirect('/admin/sign-in');

  const t = await getAdminT();
  const rawNext = (await searchParams).next;
  const next = typeof rawNext === 'string' && rawNext.startsWith('/admin') ? rawNext : null;

  return (
    <div className="rounded-[18px] bg-card p-6 shadow-soft sm:p-8">
      <StepHeader step={2} />
      <p className="mt-6 text-sm text-muted-foreground">{t('welcome.hello', { name: member.name.split(' ')[0] ?? member.name })}</p>
      <h1 className="text-display mt-1 text-3xl">{t('welcome.title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('welcome.body')}</p>
      <div className="mt-6">
        <InterestsForm initial={session.interests} next={next} />
      </div>
    </div>
  );
}
