import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { requirePermission } from '@/lib/application/admin-session';
import { BookingLinkForm } from './settings-form';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';

export default async function SettingsPage() {
  await requirePermission('team.permManageTeam');
  const hotel = await catalogService.getHotel(DEMO_HOTEL_SLUG);
  return <AdminPage width="narrow"><AdminPageHeader title="Settings" description="Connect the hotel's existing booking website." />
    <div className="mt-8 rounded-[18px] bg-card p-6 shadow-soft"><BookingLinkForm initialUrl={hotel.bookingUrl ?? ''} /></div>
    <p className="mt-5 text-sm text-muted-foreground">Staff access is configured with ADMIN_PASSWORD and optional EDITOR_PASSWORD. Editors can manage content and reference prices; settings require administrator access.</p>
  </AdminPage>;
}
