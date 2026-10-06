import type { BookingStore, OrderStore } from '../domain/ports';
import type { CreateHotelOrderInput, HotelOrder, OrderStatus } from '../domain/orders';

/** Application boundary for the operational Orders grid. */
export class OrdersService {
  constructor(private readonly store: OrderStore, private readonly bookings: Pick<BookingStore, 'getBookingByReference'>) {}

  list(hotelId: string): Promise<HotelOrder[]> {
    return this.store.listOrders(hotelId);
  }

  async create(hotelId: string, input: CreateHotelOrderInput & { currency: HotelOrder['currency'] }): Promise<HotelOrder> {
    if (input.bookingReference) {
      const booking = await this.bookings.getBookingByReference(input.bookingReference);
      if (!booking || booking.hotelId !== hotelId || booking.status !== 'confirmed') throw new Error('ORDER_BOOKING_UNAVAILABLE');
      const date = input.dueAt.slice(0, 10);
      const roomNumber = booking.roomAssignments?.find((period) => period.fromDate <= date && date < period.toDate)?.roomNumber ?? booking.unitNumber;
      input = { ...input, guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, roomNumber: roomNumber ?? '' };
    }
    const existing = await this.store.listOrders(hotelId);
    const nextId = String(Math.max(0, ...existing.map((order) => Number(order.id)).filter(Number.isFinite)) + 1);
    const order: HotelOrder = {
      id: nextId,
      hotelId,
      createdAt: new Date().toISOString(),
      ...input,
      roomNumber: input.roomNumber || null,
      chatCount: 0,
      bookingReference: input.bookingReference || null,
    };
    return this.store.createOrder(order);
  }

  setStatus(hotelId: string, orderId: string, status: OrderStatus): Promise<HotelOrder | null> {
    return this.store.setOrderStatus(hotelId, orderId, status);
  }

  async setStatuses(hotelId: string, orderIds: string[], status: OrderStatus): Promise<{ updated: number; missing: number }> {
    const uniqueIds = [...new Set(orderIds)];
    const current = new Map((await this.store.listOrders(hotelId)).map((order) => [order.id, order]));
    let updated = 0;
    let missing = 0;
    for (const id of uniqueIds) {
      const order = current.get(id);
      if (!order) { missing++; continue; }
      if (order.status === status) continue;
      if (await this.store.setOrderStatus(hotelId, id, status)) updated++;
      else missing++;
    }
    return { updated, missing };
  }

  async update(hotelId: string, orderId: string, input: Omit<CreateHotelOrderInput, 'status'>): Promise<HotelOrder | null> {
    const existing = (await this.store.listOrders(hotelId)).find((order) => order.id === orderId);
    if (!existing) return null;
    if (existing.status !== 'new') throw new Error('ORDER_NOT_EDITABLE');
    if (input.bookingReference) {
      const booking = await this.bookings.getBookingByReference(input.bookingReference);
      if (!booking || booking.hotelId !== hotelId || (input.bookingReference !== existing.bookingReference && booking.status !== 'confirmed')) throw new Error('ORDER_BOOKING_UNAVAILABLE');
      const date = input.dueAt.slice(0, 10);
      const roomNumber = booking.roomAssignments?.find((period) => period.fromDate <= date && date < period.toDate)?.roomNumber ?? booking.unitNumber;
      input = { ...input, guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, roomNumber: roomNumber ?? '' };
    }
    return this.store.updateOrder({ ...existing, ...input, roomNumber: input.roomNumber || null, bookingReference: input.bookingReference || null });
  }
}
