import { notFound } from 'next/navigation';
import { catalogService, ordersService, hotelRepository } from '@/lib/application/container';
import { requirePermission } from '@/lib/application/admin-session';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT, adminPageTitle } from '@/lib/i18n/admin/translate';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { OrderDetails } from '@/components/admin/orders/order-view-modal';
import { CreateOrderButton } from '@/components/admin/orders/create-order-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('orders.orderDetails')) };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('team.permViewBookings');
  const { id } = await params;
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const order = (await ordersService.list(hotel.id)).find((item) => item.id === id);
  if (!order) notFound();
  const [addOns, linkedBooking, hotelBookings] = await Promise.all([
    catalogService.listAddOns(hotel.id),
    order.bookingReference ? hotelRepository.getBookingByReference(order.bookingReference) : Promise.resolve(null),
    hotelRepository.listBookings({ hotelId: hotel.id }),
  ]);
  const service = addOns.find((item) => item.name.trim().toLocaleLowerCase() === order.serviceName.trim().toLocaleLowerCase() && (order.category !== 'dining' || item.category === 'dining'));
  const booking = linkedBooking?.hotelId === hotel.id ? linkedBooking : null;
  const bookings = hotelBookings.filter((item) => item.status === 'confirmed' || item.reference === order.bookingReference).map((item) => ({
    reference: item.reference, guestName: `${item.guest.firstName} ${item.guest.lastName}`, email: item.guest.email,
    roomNumber: item.roomAssignments?.find((period) => period.fromDate <= order.dueAt.slice(0, 10) && order.dueAt.slice(0, 10) < period.toDate)?.roomNumber ?? item.unitNumber ?? '',
    checkIn: item.checkIn, checkOut: item.checkOut,
  }));
  const locale = await getAdminLocale();
  const t = adminT(locale);
  // Serialize display labels: SSR and hydration must use identical text.
  const timestamp = (iso: string) => new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Nicosia', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  return (
    <AdminPage>
      <AdminPageHeader title={`${t('orders.orderDetails')} #${order.id}`} breadcrumbs={[{ label: t('orders.title'), href: '/admin/orders?view=all' }]} actions={<CreateOrderButton order={order} bookings={bookings} guests={[...new Set([order.guestName, ...bookings.map((item) => item.guestName)])]} rooms={[...new Set(bookings.map((item) => item.roomNumber).filter(Boolean))]} services={[...new Set([order.serviceName, ...addOns.map((item) => item.name)])]} />} />
      <OrderDetails order={order} service={service} createdLabel={timestamp(order.createdAt)} dueLabel={timestamp(order.dueAt)} booking={booking ? { reference: booking.reference, guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, email: booking.guest.email, checkIn: booking.checkIn, checkOut: booking.checkOut } : null} />
    </AdminPage>
  );
}
