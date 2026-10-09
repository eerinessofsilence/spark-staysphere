import { expect, it } from 'vitest';
import { mockOrderStore } from './orders-store-mock';
import type { HotelOrder } from '../domain/orders';

it('rejects a stale edit after the stored order leaves New', async () => {
  const order: HotelOrder = {
    id: 'edit-race-test', hotelId: 'edit-race-hotel', guestName: 'Test', roomNumber: null,
    serviceName: 'Dinner', category: 'dining', delivery: 'Without delivery',
    dueAt: '2026-10-03T18:00:00Z', createdAt: '2026-10-03T10:00:00Z',
    status: 'new', paymentStatus: 'unpaid', total: 20, extras: 0, chatCount: 0, currency: 'EUR', bookingReference: null,
  };
  await mockOrderStore.createOrder(order);
  await mockOrderStore.setOrderStatus(order.hotelId, order.id, 'confirmed');
  await expect(mockOrderStore.updateOrder({ ...order, total: 99 })).rejects.toThrow('ORDER_NOT_EDITABLE');
  expect(await mockOrderStore.listOrders(order.hotelId)).toEqual([{ ...order, status: 'confirmed' }]);
});
