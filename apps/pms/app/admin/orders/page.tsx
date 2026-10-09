import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { ChatBubbleLeftRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { CheckCircle, Clock } from '@phosphor-icons/react/dist/ssr';
import { catalogService, hotelRepository, ordersService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import type { HotelOrder, OrderCategory, OrderPaymentStatus } from '@/lib/domain/orders';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateShort, lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { SearchInput } from '@/components/ui/search-input';
import { NativeSelect } from '@/components/ui/native-select';
import { OrderRowActions, OrderStatusMenu } from '@/components/admin/orders/order-status-menu';
import { CreateOrderButton } from '@/components/admin/orders/create-order-button';
import { OrderFilters } from '@/components/admin/orders/order-filters';
import { OrderDateRangeFilter } from '@/components/admin/orders/order-date-range-filter';
import { OrderViewButton, OrderViewRow } from '@/components/admin/orders/order-view-modal';
import { OrdersBulkSelection, OrdersSelectAll, OrderSelectionCheckbox } from '@/components/admin/orders/orders-bulk-selection';

export const dynamic = 'force-dynamic';

type OrdersView = 'today' | 'all';
const categories: OrderCategory[] = ['dining', 'wellness', 'experience', 'transport', 'room'];

const categoryKey: Record<OrderCategory, AdminTranslationKey> = {
  dining: 'orders.categoryDining',
  wellness: 'orders.categoryWellness',
  experience: 'orders.categoryExperience',
  transport: 'orders.categoryTransport',
  room: 'orders.categoryRoom',
};

const paymentMeta: Record<OrderPaymentStatus, { key: AdminTranslationKey; className: string; icon: typeof CheckCircle }> = {
  paid: { key: 'orders.paid', className: 'text-status-due-in', icon: CheckCircle },
  unpaid: { key: 'orders.unpaid', className: 'text-status-new', icon: Clock },
  partial: { key: 'orders.partial', className: 'text-status-due-out', icon: Clock },
};

function parseView(value: string | string[] | undefined): OrdersView {
  return value === 'all' ? 'all' : 'today';
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function matches(order: HotelOrder, query: string): boolean {
  const needle = query.toLowerCase();
  return [order.id, order.guestName, order.serviceName, order.roomNumber ?? ''].some((value) => value.toLowerCase().includes(needle));
}

function hrefFor(params: {
  view: OrdersView;
  query?: string;
  from?: string;
  to?: string;
  guest?: string;
  category?: string;
  service?: string;
  room?: string;
}): string {
  const search = new URLSearchParams();
  if (params.view !== 'today') search.set('view', params.view);
  if (params.query) search.set('q', params.query);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.guest) search.set('guest', params.guest);
  if (params.category) search.set('category', params.category);
  if (params.service) search.set('service', params.service);
  if (params.room) search.set('room', params.room);
  const query = search.toString();
  return `/admin/orders${query ? `?${query}` : ''}`;
}

function deliveryLabel(t: ReturnType<typeof adminT>, delivery: string): string {
  if (delivery === 'Room delivery') return t('orders.roomDelivery');
  if (delivery === 'Hotel pickup') return t('orders.hotelPickup');
  return t('orders.withoutDelivery');
}

function PaymentLabel({ status, t }: { status: OrderPaymentStatus; t: ReturnType<typeof adminT> }) {
  const meta = paymentMeta[status];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground whitespace-nowrap">
      <Icon weight="fill" className={cn('size-4 shrink-0', meta.className)} aria-hidden="true" />
      {t(meta.key)}
    </span>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('orders.title')) };
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const params = await searchParams;
  const view = parseView(params.view);
  const query = typeof params.q === 'string' ? params.q.trim() : '';
  const from = typeof params.from === 'string' && isIsoDate(params.from) ? params.from : '';
  const to = typeof params.to === 'string' && isIsoDate(params.to) ? params.to : '';
  const guest = typeof params.guest === 'string' ? params.guest : '';
  const category = typeof params.category === 'string' && categories.includes(params.category as OrderCategory) ? params.category : '';
  const service = typeof params.service === 'string' ? params.service : '';
  const room = typeof params.room === 'string' ? params.room : '';
  const today = toIsoDate(new Date());

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const allOrders = await ordersService.list(hotel.id);
  const bookings = (await hotelRepository.listBookings({ hotelId: hotel.id })).filter((booking) => booking.status === 'confirmed').map((booking) => ({
    reference: booking.reference, guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, email: booking.guest.email,
    roomNumber: booking.roomAssignments?.find((period) => period.fromDate <= today && today < period.toDate)?.roomNumber ?? booking.unitNumber ?? '',
    checkIn: booking.checkIn, checkOut: booking.checkOut,
  }));
  const guests = [...new Set(allOrders.map((order) => order.guestName))].sort((a, b) => a.localeCompare(b));
  const services = [...new Set(allOrders.map((order) => order.serviceName))].sort((a, b) => a.localeCompare(b));
  const rooms = [...new Set(allOrders.map((order) => order.roomNumber).filter((value): value is string => Boolean(value)))].sort();

  const filtered = allOrders.filter((order) => {
    if (view === 'today' && dateOnly(order.dueAt) !== today) return false;
    if (query && !matches(order, query)) return false;
    if (from && dateOnly(order.dueAt) < from) return false;
    if (to && dateOnly(order.dueAt) > to) return false;
    if (guest && order.guestName !== guest) return false;
    if (category && order.category !== category) return false;
    if (service && order.serviceName !== service) return false;
    if (room && order.roomNumber !== room) return false;
    return true;
  });

  const baseFilters = { query, from, to, guest, category, service, room };
  const hasFilters = Boolean(query || from || to || guest || category || service || room);
  const hasAdvancedFilters = Boolean(from || to || guest || category || service || room);

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('orders.title')}
        description={t('orders.description')}
        actions={<CreateOrderButton guests={guests} services={services} rooms={rooms} bookings={bookings} />}
      />

      <div className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft" data-testid="orders-grid">
        <div className="border-b border-border px-4 pt-3 sm:px-6 sm:pt-4">
          <nav aria-label={t('orders.title')} className="flex gap-6">
            {(['today', 'all'] as const).map((option) => (
              <Link
                key={option}
                href={hrefFor({ view: option, ...baseFilters, from: option === 'today' ? undefined : from, to: option === 'today' ? undefined : to })}
                className={cn(
                  'relative min-h-11 px-1 text-sm font-semibold transition-colors',
                  option === view ? 'text-accent-strong after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-accent' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option === 'today' ? t('orders.today') : t('orders.all')}
              </Link>
            ))}
          </nav>
        </div>

        <form action="/admin/orders" method="get" className="border-b border-border p-4 sm:p-6">
          <input type="hidden" name="view" value={view} />
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="orders-search" className="sr-only">{t('orders.search')}</label>
            <SearchInput
              id="orders-search"
              name="q"
              defaultValue={query}
              suggestions={allOrders.map((order) => ({ value: order.id, label: order.guestName, detail: `${order.serviceName} · ${order.id}${order.roomNumber ? ` · ${order.roomNumber}` : ''}` }))}
              suggestionsLabel={t('orders.search')}
              placeholder={t('orders.search')}
              wrapperClassName="min-w-0 grow basis-60 sm:max-w-md"
            />
            <button type="submit" className={pill('primary', 'px-4')}>{t('orders.searchButton')}</button>
            {hasFilters ? <Link href={hrefFor({ view })} className={pill('secondary')}>{t('orders.reset')}</Link> : null}
            <OrderFilters initiallyOpen={hasAdvancedFilters} label={t('orders.filters')}>
              <OrderDateRangeFilter from={from} to={to} />
              <div>
                <label className="sr-only" htmlFor="orders-guest">{t('orders.selectGuest')}</label>
                <NativeSelect id="orders-guest" name="guest" defaultValue={guest}>
                  <option value="">{t('orders.selectGuest')}</option>
                  {guests.map((name) => <option key={name} value={name}>{name}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className="sr-only" htmlFor="orders-category">{t('orders.allCategories')}</label>
                <NativeSelect id="orders-category" name="category" defaultValue={category}>
                  <option value="">{t('orders.allCategories')}</option>
                  {categories.map((value) => <option key={value} value={value}>{t(categoryKey[value])}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className="sr-only" htmlFor="orders-service">{t('orders.allServices')}</label>
                <NativeSelect id="orders-service" name="service" defaultValue={service}>
                  <option value="">{t('orders.allServices')}</option>
                  {services.map((name) => <option key={name} value={name}>{name}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className="sr-only" htmlFor="orders-room">{t('orders.allResources')}</label>
                <NativeSelect id="orders-room" name="room" defaultValue={room}>
                  <option value="">{t('orders.allResources')}</option>
                  {rooms.map((number) => <option key={number} value={number}>{number}</option>)}
                </NativeSelect>
              </div>
            </OrderFilters>
          </div>
        </form>

        <div className="border-b border-border bg-stone/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          {t('orders.demoNote')}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
              <MagnifyingGlassIcon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-display text-2xl">{hasFilters || view === 'today' ? t('orders.noMatchTitle') : t('orders.emptyTitle')}</h2>
            <p className="max-w-md text-sm text-muted-foreground">{hasFilters || view === 'today' ? t('orders.noMatchBody') : t('orders.emptyBody')}</p>
            {hasFilters || view === 'today' ? <Link href={hrefFor({ view: 'all' })} className={pill('secondary')}>{t('orders.clear')}</Link> : null}
          </div>
        ) : (
          <OrdersBulkSelection orders={filtered.map(({ id, status }) => ({ id, status }))}>
          <TableCard caption={t('orders.tableCaption')} className="min-w-[88rem]" attached>
            <thead>
              <tr className="border-b border-border bg-stone/30">
                <Th className="w-12"><OrdersSelectAll /></Th>
                <Th>{t('orders.thId')}</Th>
                <Th>{t('orders.thTime')}</Th>
                <Th>{t('orders.thGuest')}</Th>
                <Th>{t('orders.thRoom')}</Th>
                <Th>{t('orders.thService')}</Th>
                <Th>{t('orders.thDelivery')}</Th>
                <Th>{t('orders.thChat')}</Th>
                <Th className="text-right">{t('orders.thSum')}</Th>
                <Th className="text-right">{t('orders.thExtras')}</Th>
                <Th>{t('orders.thPaid')}</Th>
                <Th>{t('orders.thStatus')}</Th>
                <Th className="w-14"><span className="sr-only">{t('orders.thActions')}</span></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const date = dateOnly(order.createdAt);
                return (
                  <OrderViewRow key={order.id} orderId={order.id}>
                    <Td className="w-12"><OrderSelectionCheckbox orderId={order.id} /></Td>
                    <Td className="whitespace-nowrap"><OrderViewButton order={order} /></Td>
                    <Td className="whitespace-nowrap"><span className="block">{lDateShort(date, locale)}</span><span className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'HH:mm')}</span></Td>
                    <Td className="min-w-44"><span className="font-medium">{order.guestName}</span></Td>
                    <Td className="whitespace-nowrap">{order.roomNumber ?? <span className="text-muted-foreground">—</span>}</Td>
                    <Td className="min-w-56"><span className="font-medium">{order.serviceName}</span><span className="block text-xs text-muted-foreground">{t(categoryKey[order.category])}</span></Td>
                    <Td className="whitespace-nowrap text-sm">{deliveryLabel(t, order.delivery)}</Td>
                    <Td><span className="inline-flex items-center gap-1.5 tabular-nums"><ChatBubbleLeftRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />{order.chatCount}</span></Td>
                    <Td className="text-right font-medium tabular-nums whitespace-nowrap">{lMoney(order.total, order.currency, locale)}</Td>
                    <Td className="text-right tabular-nums">{order.extras}</Td>
                    <Td><PaymentLabel status={order.paymentStatus} t={t} /></Td>
                    <Td><OrderStatusMenu orderId={order.id} status={order.status} /></Td>
                    <Td className="relative z-10 text-right"><OrderRowActions orderId={order.id} bookingReference={order.bookingReference} /></Td>
                  </OrderViewRow>
                );
              })}
            </tbody>
          </TableCard>
          </OrdersBulkSelection>
        )}
      </div>
    </AdminPage>
  );
}
