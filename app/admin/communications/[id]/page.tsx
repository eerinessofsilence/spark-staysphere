import type { Metadata } from 'next';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { Inbox } from '@/components/admin/communications/inbox';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('comms.title')) };
}

/** One thread open — the same inbox, with this conversation in the right column (or alone, on a phone). */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Inbox currentId={id} />;
}
