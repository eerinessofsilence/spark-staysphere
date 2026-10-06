import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { subscriptionService } from '@/lib/application/container';
import { AdminPage } from '@/components/admin/shell/admin-page';
import { SubscriptionCheckout } from '@/components/admin/settings/subscription-checkout';

export const dynamic = 'force-dynamic';
export default async function CheckoutPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');
  return <AdminPage width="narrow"><SubscriptionCheckout modules={await subscriptionService.listModules()} storageKey={`subscription-demo.${session.memberId}`} /></AdminPage>;
}
