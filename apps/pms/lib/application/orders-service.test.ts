import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders-service';
import type { HotelOrder } from '../domain/orders';
import type { OrderStore } from '../domain/ports';
import type { Booking } from '../domain/schemas';

const original: HotelOrder = {
  id: '42', hotelId: 'hotel', guestName: 'Guest', roomNumber: '101', serviceName: 'Dinner',
  category: 'dining', delivery: 'Room delivery', dueAt: '2026-10-03T18:30:45Z', createdAt: '2026-10-01T10:00:00Z',
  status: 'new', paymentStatus: 'paid', total: 40, extras: 1, chatCount: 3, currency: 'EUR', bookingReference: null,
};

function setup(booking: Booking | null = null, status: HotelOrder['status'] = 'new') {
  let saved = { ...original, status };
  const store: OrderStore = {
    listOrders: async (hotelId) => hotelId === saved.hotelId ? [saved] : [],
    createOrder: vi.fn(), setOrderStatus: vi.fn(),
    updateOrder: vi.fn(async (order) => { saved = order; return order; }),
  };
  return { store, service: new OrdersService(store, { getBookingByReference: async () => booking }) };
}

const edit = { guestName: 'Updated Guest', roomNumber: '202', serviceName: 'Lunch', category: 'dining' as const,
  delivery: 'Hotel pickup' as const, dueAt: original.dueAt, total: 55, extras: 2, paymentStatus: 'partial' as const };

describe('order editing', () => {
  it.each(['confirmed', 'in_progress', 'ready', 'completed', 'cancelled'] as const)('rejects editing in %s status', async (status) => {
    const { service, store } = setup(null, status);
    await expect(service.update('hotel', '42', edit)).rejects.toThrow('ORDER_NOT_EDITABLE');
    expect(store.updateOrder).not.toHaveBeenCalled();
    expect(await service.list('hotel')).toEqual([{ ...original, status }]);
  });
  it('updates editable fields while preserving the order identity, status and history', async () => {
    const { service, store } = setup();
    expect(await service.update('hotel', '42', edit)).toEqual({ ...original, ...edit });
    expect(store.createOrder).not.toHaveBeenCalled();
    expect(await service.list('hotel')).toEqual([{ ...original, ...edit }]);
  });
  it('does not update an order belonging to another hotel', async () => {
    const { service, store } = setup();
    expect(await service.update('other-hotel', '42', edit)).toBeNull();
    expect(store.updateOrder).not.toHaveBeenCalled();
  });
  it('rejects unavailable booking links', async () => {
    const { service, store } = setup();
    await expect(service.update('hotel', '42', { ...edit, bookingReference: 'missing' })).rejects.toThrow('ORDER_BOOKING_UNAVAILABLE');
    expect(store.updateOrder).not.toHaveBeenCalled();
  });
  it('derives the guest and room from the booking instead of submitted text', async () => {
    const booking = { hotelId: 'hotel', reference: 'BOOK', status: 'confirmed', guest: { firstName: 'Anna', lastName: 'Smith' }, unitNumber: '303', roomAssignments: [] } as unknown as Booking;
    const { service } = setup(booking);
    const updated = await service.update('hotel', '42', { ...edit, bookingReference: 'BOOK' });
    expect(updated).toMatchObject({ guestName: 'Anna Smith', roomNumber: '303', bookingReference: 'BOOK' });
    expect(await service.update('hotel', '42', edit)).toMatchObject({ bookingReference: null, guestName: edit.guestName });
  });
});

describe('bulk order status', () => {
  it('updates unique hotel orders, skips unchanged statuses and reports missing IDs', async () => {
    const rows = [original, { ...original, id: '43', status: 'confirmed' as const }, { ...original, id: '44', hotelId: 'other-hotel' }];
    const store: OrderStore = {
      listOrders: async (hotelId) => rows.filter((order) => order.hotelId === hotelId),
      createOrder: vi.fn(), updateOrder: vi.fn(),
      setOrderStatus: vi.fn(async (hotelId, id, status) => {
        const index = rows.findIndex((order) => order.hotelId === hotelId && order.id === id);
        if (index < 0) return null;
        rows[index] = { ...rows[index]!, status };
        return rows[index]!;
      }),
    };
    const service = new OrdersService(store, { getBookingByReference: async () => null });
    expect(await service.setStatuses('hotel', ['42', '42', '43', '44', 'gone'], 'confirmed'))
      .toEqual({ updated: 1, missing: 2 });
    expect(store.setOrderStatus).toHaveBeenCalledTimes(1);
    expect(rows[0]?.status).toBe('confirmed');
    expect(rows[2]?.status).toBe('new');
  });
});
