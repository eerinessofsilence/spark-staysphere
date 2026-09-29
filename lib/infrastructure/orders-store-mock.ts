import type { OrderStore } from '../domain/ports';
import type { HotelOrder, OrderStatus } from '../domain/orders';
import { demoHotel } from './mock-data';

/**
 * Process-local demo adapter for Orders. It gives the back office a useful
 * operational surface before a live PMS/channel-manager order feed is wired
 * in. Status writes use the same port a production adapter will implement.
 */
const now = new Date();

function at(days: number, hour: number, minute: number): string {
  const value = new Date(now);
  value.setDate(value.getDate() + days);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

const seededOrders: HotelOrder[] = [
  {
    id: '11482', hotelId: demoHotel.id, createdAt: at(0, 9, 14), dueAt: at(0, 21, 0),
    guestName: 'Workbank Prueflauf', roomNumber: null, serviceName: 'Buffalo chicken', category: 'dining',
    delivery: 'Without delivery', chatCount: 0, total: 0, currency: demoHotel.currency, extras: 0,
    paymentStatus: 'unpaid', status: 'cancelled', bookingReference: null,
  },
  {
    id: '11481', hotelId: demoHotel.id, createdAt: at(-1, 17, 38), dueAt: at(-1, 18, 0),
    guestName: 'Workbank Prueflauf', roomNumber: null, serviceName: 'Buffalo chicken', category: 'dining',
    delivery: 'Without delivery', chatCount: 0, total: 0, currency: demoHotel.currency, extras: 0,
    paymentStatus: 'unpaid', status: 'cancelled', bookingReference: null,
  },
  {
    id: '11480', hotelId: demoHotel.id, createdAt: at(-1, 20, 42), dueAt: at(-1, 21, 0),
    guestName: 'Workbank Prueflauf', roomNumber: null, serviceName: 'Buffalo chicken', category: 'dining',
    delivery: 'Without delivery', chatCount: 1, total: 0, currency: demoHotel.currency, extras: 0,
    paymentStatus: 'unpaid', status: 'cancelled', bookingReference: null,
  },
  {
    id: '11479', hotelId: demoHotel.id, createdAt: at(-2, 17, 15), dueAt: at(1, 18, 0),
    guestName: 'Hanna Kowalska', roomNumber: '401', serviceName: 'Cappuccino', category: 'dining',
    delivery: 'Room delivery', chatCount: 0, total: 8, currency: demoHotel.currency, extras: 1,
    paymentStatus: 'unpaid', status: 'confirmed', bookingReference: null,
  },
  {
    id: '11478', hotelId: demoHotel.id, createdAt: at(-3, 19, 26), dueAt: at(0, 20, 0),
    guestName: 'Emma Johansson', roomNumber: '402', serviceName: 'Sunset boat trip', category: 'experience',
    delivery: 'Without delivery', chatCount: 2, total: 180, currency: demoHotel.currency, extras: 0,
    paymentStatus: 'paid', status: 'in_progress', bookingReference: null,
  },
  {
    id: '11477', hotelId: demoHotel.id, createdAt: at(-4, 16, 10), dueAt: at(0, 17, 45),
    guestName: 'Yusuf Demir', roomNumber: '402', serviceName: 'Tennis court', category: 'wellness',
    delivery: 'Without delivery', chatCount: 0, total: 100, currency: demoHotel.currency, extras: 0,
    paymentStatus: 'unpaid', status: 'confirmed', bookingReference: null,
  },
  {
    id: '11476', hotelId: demoHotel.id, createdAt: at(-4, 11, 20), dueAt: at(2, 11, 0),
    guestName: 'Lukas Weber', roomNumber: '305', serviceName: 'Breakfast in room', category: 'dining',
    delivery: 'Room delivery', chatCount: 0, total: 42, currency: demoHotel.currency, extras: 2,
    paymentStatus: 'paid', status: 'ready', bookingReference: null,
  },
  {
    id: '11475', hotelId: demoHotel.id, createdAt: at(-5, 10, 5), dueAt: at(3, 9, 0),
    guestName: 'Amelia Clarke', roomNumber: '205', serviceName: 'Spa ritual', category: 'wellness',
    delivery: 'Without delivery', chatCount: 1, total: 140, currency: demoHotel.currency, extras: 0,
    paymentStatus: 'partial', status: 'new', bookingReference: null,
  },
  {
    id: '11474', hotelId: demoHotel.id, createdAt: at(-7, 14, 50), dueAt: at(4, 12, 30),
    guestName: 'Nadia Haddad', roomNumber: '108', serviceName: 'Airport transfer', category: 'transport',
    delivery: 'Hotel pickup', chatCount: 0, total: 65, currency: demoHotel.currency, extras: 1,
    paymentStatus: 'paid', status: 'confirmed', bookingReference: null,
  },
  {
    id: '11473', hotelId: demoHotel.id, createdAt: at(-8, 13, 25), dueAt: at(5, 19, 30),
    guestName: 'Charlotte Dubois', roomNumber: '801', serviceName: 'Terrace dinner', category: 'dining',
    delivery: 'Room delivery', chatCount: 3, total: 96, currency: demoHotel.currency, extras: 2,
    paymentStatus: 'paid', status: 'new', bookingReference: null,
  },
  {
    id: '11472', hotelId: demoHotel.id, createdAt: at(-10, 18, 2), dueAt: at(-2, 16, 0),
    guestName: 'Daniel Novak', roomNumber: '602', serviceName: 'Late check-out', category: 'room',
    delivery: 'Without delivery', chatCount: 0, total: 35, currency: demoHotel.currency, extras: 0,
    paymentStatus: 'paid', status: 'completed', bookingReference: null,
  },
];

const orders = new Map(seededOrders.map((order) => [order.id, order]));

export const mockOrderStore: OrderStore = {
  async listOrders(hotelId) {
    return [...orders.values()]
      .filter((order) => order.hotelId === hotelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async createOrder(order) {
    orders.set(order.id, order);
    return order;
  },
  async setOrderStatus(hotelId, orderId, status: OrderStatus) {
    const order = orders.get(orderId);
    if (!order || order.hotelId !== hotelId) return null;
    const updated = { ...order, status };
    orders.set(orderId, updated);
    return updated;
  },
};
