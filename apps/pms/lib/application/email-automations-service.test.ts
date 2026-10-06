import { describe, expect, it, vi } from 'vitest';
import type { AutomationRuleStore, AutomationSendLogStore, HotelRepository } from '../domain/ports';
import { bookingSchema, type Hotel } from '../domain/schemas';
import type { CommunicationsService } from './communications-service';
import { EmailAutomationsService } from './email-automations-service';

const hotel = { id: 'hotel-1', slug: 'asteria-cove', name: 'Asteria Cove', currency: 'EUR' } as Hotel;
const booking = bookingSchema.parse({
  id: 'booking-1', reference: 'TEST01', idempotencyKey: 'test-email', hotelId: hotel.id,
  roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-12-10', checkOut: '2026-12-12',
  adults: 2, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '123456789' },
  addOnIds: [], total: 200, currency: 'EUR', status: 'confirmed', createdAt: '2026-10-01T00:00:00.000Z',
});

function setup() {
  const sendSystemEmail = vi.fn(async (..._args: Parameters<CommunicationsService['sendSystemEmail']>) => {});
  const service = new EmailAutomationsService(
    { list: async () => [] } as unknown as AutomationRuleStore,
    {} as AutomationSendLogStore,
    { getHotel: async (slug: string) => slug === hotel.slug ? hotel : null } as HotelRepository,
    { sendSystemEmail } as unknown as CommunicationsService,
    new Map([[hotel.id, hotel.slug]]),
  );
  return { service, sendSystemEmail };
}

describe('EmailAutomationsService booking events', () => {
  it('sends the built-in confirmation and cancellation to the booking email thread', async () => {
    const { service, sendSystemEmail } = setup();
    await service.notifyConfirmed(booking);
    await service.notifyCancelled({ ...booking, status: 'cancelled', cancellationReason: 'Guest changed plans' });
    expect(sendSystemEmail).toHaveBeenCalledTimes(2);
    expect(sendSystemEmail.mock.calls[0]?.[1]).toBe(booking.reference);
    expect(sendSystemEmail.mock.calls[0]?.[2]).toContain('confirmed');
    expect(sendSystemEmail.mock.calls[1]?.[2]).toContain('cancelled');
    expect(sendSystemEmail.mock.calls[1]?.[3]).toContain('Reason: Guest changed plans');
  });

  it('explains stay-status, date, room, and named-guest changes', async () => {
    const { service, sendSystemEmail } = setup();
    await service.notifyStayStateChanged({ ...booking, stayState: 'checked_in' });
    await service.notifyBookingChanged(booking, { kind: 'dates', oldCheckIn: '2026-12-10', oldCheckOut: '2026-12-12', newCheckIn: '2026-12-10', newCheckOut: '2026-12-14', newTotal: 400 });
    await service.notifyBookingChanged(booking, { kind: 'room', oldRoom: '101', newRoom: '102', effectiveDate: '2026-12-10' });
    await service.notifyBookingChanged(booking, { kind: 'guest_added', guest: { id: 'guest-2', bookingId: booking.id, category: 'adult', firstName: 'Grace', lastName: 'Hopper', createdAt: '2026-10-02T00:00:00.000Z' } });
    expect(sendSystemEmail).toHaveBeenCalledTimes(4);
    expect(sendSystemEmail.mock.calls.map((call) => call[2])).toEqual([
      expect.stringContaining('Check-in'),
      expect.stringContaining('dates changed'),
      expect.stringContaining('Room assignment changed'),
      expect.stringContaining('Guest added'),
    ]);
    expect(sendSystemEmail.mock.calls[1]?.[3]).toContain('14 Dec 2026');
    expect(sendSystemEmail.mock.calls[2]?.[3]).toContain('101 → 102');
    expect(sendSystemEmail.mock.calls[3]?.[3]).toContain('Grace Hopper');
  });
});
