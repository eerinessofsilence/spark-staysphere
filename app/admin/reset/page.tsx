import type { Metadata } from 'next';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { SampleBookingsButton } from '@/components/admin/operations/sample-bookings-button';
import { ResetDemoButton } from '@/components/admin/room-controls';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('reset.title')) };
}

/**
 * Not in the sidebar on purpose — a hotel team shouldn't stumble onto a
 * button that wipes every demo booking. It still has to live behind a real
 * server action rather than an API route (CLAUDE.md: "the back office is
 * server actions only, no new API routes"), and the e2e suites still need a
 * real control to click to start each run from a clean slate — this page is
 * that control, reachable by URL for the demo owner and the test harness,
 * not by navigation.
 */
export default async function ResetDemoPage() {
  const t = await getAdminT();
  return (
    <AdminPage width="narrow">
      <AdminPageHeader title={t('reset.title')} />
      {/* The two demo controls together: wipe, and refill with the sample stays
          — the refill is otherwise only offered on an empty reservations list. */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ResetDemoButton />
        <SampleBookingsButton />
      </div>
    </AdminPage>
  );
}
