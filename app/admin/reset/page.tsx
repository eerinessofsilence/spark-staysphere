import type { Metadata } from 'next';
import { ResetDemoButton } from '@/components/admin/room-controls';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Reset demo state — Hotel admin | SPARK StaySphere 360' };

/**
 * Not in the sidebar on purpose — a hotel team shouldn't stumble onto a
 * button that wipes every demo booking. It still has to live behind a real
 * server action rather than an API route (CLAUDE.md: "the back office is
 * server actions only, no new API routes"), and the e2e suites still need a
 * real control to click to start each run from a clean slate — this page is
 * that control, reachable by URL for the demo owner and the test harness,
 * not by navigation.
 */
export default function ResetDemoPage() {
  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Reset demo state"
        description="Clears every demo booking, payment attempt, availability override and CMS edit, back to the seed catalog. There is no undo."
      />
      <div className="mt-8">
        <ResetDemoButton />
      </div>
    </AdminPage>
  );
}
