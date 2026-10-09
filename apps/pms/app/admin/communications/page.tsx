import type { Metadata } from 'next';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { Inbox } from '@/components/admin/communications/inbox';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('comms.title')) };
}

/** The guest inbox with no thread open — see `components/admin/communications/inbox.tsx`. */
export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <Inbox currentId={null} hotelSlugOverride={typeof params.hotel === 'string' ? params.hotel : undefined} />;
}
