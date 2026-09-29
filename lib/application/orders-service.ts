import type { OrderStore } from '../domain/ports';
import type { CreateHotelOrderInput, HotelOrder, OrderStatus } from '../domain/orders';

/** Application boundary for the operational Orders grid. */
export class OrdersService {
  constructor(private readonly store: OrderStore) {}

  list(hotelId: string): Promise<HotelOrder[]> {
    return this.store.listOrders(hotelId);
  }

  async create(hotelId: string, input: CreateHotelOrderInput & { currency: HotelOrder['currency'] }): Promise<HotelOrder> {
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
}
