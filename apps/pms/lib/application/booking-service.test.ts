import { describe, expect, it, vi } from 'vitest';
import type { Booking, BookingRequest, PaymentAttempt, Quote } from '../domain/schemas';
import type { BookingEngineAdapter, Clock, PaymentProvider } from '../domain/ports';
import { BookingService } from './booking-service';

const now = '2035-01-01T12:00:00.000Z';
const quote = {
  roomTypeId: 'room-test', ratePlanId: 'rate-test', addOnIds: [], available: true,
  price: { total: 200, currency: 'EUR' },
} as Quote;

function request(idempotencyKey: string, paymentMethod: BookingRequest['paymentMethod'] = 'card'): BookingRequest {
  return {
    idempotencyKey, hotelId: 'hotel-test', roomTypeId: 'room-test', ratePlanId: 'rate-test',
    checkIn: '2035-02-01', checkOut: '2035-02-03', adults: 2, children: 0,
    guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '123456789' },
    addOnIds: [], expectedTotal: 200, paymentMethod,
  };
}

function setup(options: {
  available?: boolean;
  total?: number;
  provider?: PaymentProvider;
  failAfterCommit?: boolean;
  afterConfirm?: (booking: Booking) => Promise<void>;
  afterRefundRecorded?: (booking: Booking, attempt: PaymentAttempt) => Promise<void>;
} = {}) {
  const bookings = new Map<string, Booking>();
  const attempts = new Map<string, PaymentAttempt[]>();
  const holds = new Map<string, number>();
  const bookingEngine = {
    quote: vi.fn(async () => ({
      ...quote,
      available: options.available ?? true,
      price: { total: options.total ?? 200, currency: 'EUR' },
    })),
    hold: vi.fn(async () => ({ holdId: 'hold-test', expiresAt: now })),
  } as unknown as BookingEngineAdapter;
  const paymentProvider = options.provider ?? {
    authorizeDemo: vi.fn(async ({ bookingId, amount, currency }) => ({
      paymentAttemptId: `provider-${bookingId}`, authorized: amount > 0 && currency === 'EUR',
    })),
  };
  let loseAck = options.failAfterCommit ?? false;
  const repository = {
    async findBookingByIdempotencyKey(key: string) { return bookings.get(key) ?? null; },
    async getBookingByReference(reference: string) {
      return [...bookings.values()].find((booking) => booking.reference === reference) ?? null;
    },
    async listPhysicalRooms() { return [{ id: 'unit-test', roomTypeId: 'room-test', number: '101', floor: 1 }]; },
    async saveBooking(booking: Booking, capacity?: number, initialPayment?: PaymentAttempt) {
      const existing = bookings.get(booking.idempotencyKey);
      if (existing) return existing;
      const occupied = [...holds.values()].reduce((sum, count) => sum + count, 0);
      if (capacity !== undefined && occupied >= capacity) {
        const error = new Error('Room inventory changed before confirmation.');
        error.name = 'BookingInventoryConflictError';
        throw error;
      }
      bookings.set(booking.idempotencyKey, booking);
      for (const night of ['2035-02-01', '2035-02-02']) holds.set(night, (holds.get(night) ?? 0) + 1);
      if (initialPayment) attempts.set(booking.id, [initialPayment]);
      if (loseAck) { loseAck = false; throw new Error('Acknowledgement lost after commit.'); }
      return booking;
    },
    async listPaymentAttempts(bookingId: string) { return attempts.get(bookingId) ?? []; },
    async savePaymentAttempt(attempt: PaymentAttempt) {
      attempts.set(attempt.bookingId, [...(attempts.get(attempt.bookingId) ?? []), attempt]);
      return attempt;
    },
    async saveRefundWithinBalance(attempt: PaymentAttempt) {
      const payments = attempts.get(attempt.bookingId) ?? [];
      const available = payments.filter((item) => item.currency === attempt.currency && item.status === 'authorized').reduce((sum, item) => sum + item.amount, 0)
        - payments.filter((item) => item.currency === attempt.currency && item.status === 'refunded').reduce((sum, item) => sum + item.amount, 0);
      if (attempt.amount > available) return false;
      attempts.set(attempt.bookingId, [...payments, attempt]);
      return true;
    },
  };
  const clock: Clock = { now: () => new Date(now) };
  const service = new BookingService(
    repository as never,
    bookingEngine,
    paymentProvider,
    undefined,
    undefined,
    clock,
    undefined,
    options.afterConfirm,
    undefined,
    undefined,
    undefined,
    options.afterRefundRecorded,
  );
  return { service, repository, bookingEngine, paymentProvider, bookings, attempts, holds };
}

describe('BookingService.confirm', () => {
  it('rejects invalid requests, unavailable inventory and changed prices before side effects', async () => {
    const invalid = setup();
    await expect(invalid.service.confirm({ ...request('invalid-key'), idempotencyKey: 'short' })).rejects.toMatchObject({ code: 'invalid_request' });
    expect(invalid.bookingEngine.hold).not.toHaveBeenCalled();

    const unavailable = setup({ available: false });
    await expect(unavailable.service.confirm(request('unavailable-key'))).rejects.toMatchObject({ code: 'unavailable' });
    expect(unavailable.paymentProvider.authorizeDemo).not.toHaveBeenCalled();
    expect(unavailable.bookings.size).toBe(0);

    const changed = setup({ total: 225 });
    await expect(changed.service.confirm(request('changed-price-key'))).rejects.toMatchObject({
      code: 'price_changed', details: { currentTotal: 225 },
    });
    expect(changed.bookingEngine.hold).not.toHaveBeenCalled();
    expect(changed.paymentProvider.authorizeDemo).not.toHaveBeenCalled();
    expect(changed.bookings.size).toBe(0);
  });

  it('rejects a declined or failed authorization without persisting a booking', async () => {
    const declined = setup({ provider: { authorizeDemo: vi.fn(async () => ({ paymentAttemptId: 'declined', authorized: false })) } });
    await expect(declined.service.confirm(request('declined-key'))).rejects.toMatchObject({ code: 'payment_declined' });
    expect(declined.bookings.size).toBe(0);

    const failed = setup({ provider: { authorizeDemo: vi.fn(async () => { throw new Error('provider unavailable'); }) } });
    await expect(failed.service.confirm(request('provider-error-key'))).rejects.toThrow('provider unavailable');
    expect(failed.bookings.size).toBe(0);
  });

  it.each(['card', 'apple_pay', 'google_pay'] as const)('authorizes %s and records one authorized attempt', async (method) => {
    const state = setup();
    const booking = await state.service.confirm(request(`authorize-${method}-key`, method));
    expect(state.paymentProvider.authorizeDemo).toHaveBeenCalledTimes(1);
    expect(state.attempts.get(booking.id)).toMatchObject([{ status: 'authorized', amount: 200, operatorId: 'guest_checkout' }]);
  });

  it.each(['bank_transfer', 'pay_at_hotel'] as const)('leaves %s pending without an authorization call', async (method) => {
    const state = setup();
    const booking = await state.service.confirm(request(`pending-${method}-key`, method));
    expect(state.paymentProvider.authorizeDemo).not.toHaveBeenCalled();
    expect(state.attempts.get(booking.id)).toMatchObject([{ status: 'demo_pending', amount: 200 }]);
  });

  it('replays the same key without another hold or payment attempt', async () => {
    const state = setup();
    const first = await state.service.confirm(request('replay-booking-key'));
    const replay = await state.service.confirm(request('replay-booking-key'));
    expect(replay).toEqual(first);
    expect(state.bookingEngine.hold).toHaveBeenCalledTimes(1);
    expect(state.paymentProvider.authorizeDemo).toHaveBeenCalledTimes(1);
    expect(state.attempts.get(first.id)).toHaveLength(1);
  });

  it('keeps concurrent idempotent confirmation writes to one booking and one payment row', async () => {
    const state = setup();
    const outcomes = await Promise.all([
      state.service.confirm(request('concurrent-replay-key')),
      state.service.confirm(request('concurrent-replay-key')),
    ]);
    expect(outcomes[0]!.id).toBe(outcomes[1]!.id);
    expect(state.bookings.size).toBe(1);
    expect(state.attempts.get(outcomes[0]!.id)).toHaveLength(1);
  });

  it('lets only one different request take the last available room', async () => {
    const state = setup();
    const outcomes = await Promise.allSettled([
      state.service.confirm(request('last-room-one')),
      state.service.confirm(request('last-room-two')),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    const rejection = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejection).toMatchObject({ status: 'rejected', reason: { code: 'unavailable' } });
    expect(state.bookings.size).toBe(1);
    expect([...state.attempts.values()].flat()).toHaveLength(1);
  });

  it('recovers a lost commit acknowledgement on retry without duplicating the hold or payment', async () => {
    const state = setup({ failAfterCommit: true });
    await expect(state.service.confirm(request('lost-ack-booking-key'))).rejects.toThrow('Acknowledgement lost');
    const booking = await state.service.confirm(request('lost-ack-booking-key'));
    expect(state.bookings.size).toBe(1);
    expect(state.holds.get('2035-02-01')).toBe(1);
    expect(state.attempts.get(booking.id)).toHaveLength(1);
    expect(state.paymentProvider.authorizeDemo).toHaveBeenCalledTimes(1);
  });

  it('keeps the saved booking when a downstream notification fails', async () => {
    const state = setup({ afterConfirm: async () => { throw new Error('email offline'); } });
    await expect(state.service.confirm(request('notification-failure-key'))).resolves.toMatchObject({ status: 'confirmed' });
    expect(state.bookings.size).toBe(1);
    expect(state.attempts.values().next().value).toHaveLength(1);
  });
});

describe('BookingService.recordManualPayment and recordRefund', () => {
  function confirmedState() {
    const state = setup();
    return state.service.confirm(request('refund-fixture-booking-key', 'pay_at_hotel')).then((booking) => ({ ...state, booking }));
  }

  it('validates manual payment and refund amounts after rounding', async () => {
    const state = await confirmedState();
    for (const amount of [0, -1, Number.NaN, 0.004]) {
      await expect(state.service.recordManualPayment(state.booking.reference, 'cash', amount)).resolves.toMatchObject({ outcome: 'invalid_amount' });
      await expect(state.service.recordRefund(state.booking.reference, 'cash', amount, 0, '', 'full', [], '')).resolves.toMatchObject({ outcome: 'invalid_amount' });
    }
    expect(state.attempts.get(state.booking.id)).toHaveLength(1);
    await expect(state.service.recordRefund('MISSING', 'cash', 10, 0, '', 'full', [], '')).resolves.toMatchObject({ outcome: 'not_found' });
    await expect(state.service.recordManualPayment('MISSING', 'cash', 10)).resolves.toMatchObject({ outcome: 'not_found' });
    await expect(state.service.recordRefund(state.booking.reference, 'cash', 10, 101, '', 'full', [], '')).resolves.toMatchObject({ outcome: 'invalid_amount' });
  });

  it('records a rounded manual payment with its currency and operator, and rejects cancelled bookings', async () => {
    const state = await confirmedState();
    await expect(state.service.recordManualPayment(state.booking.reference, 'cash', 12.345, { id: 'desk-1', name: 'Front Desk' }))
      .resolves.toMatchObject({ outcome: 'recorded' });
    expect(state.attempts.get(state.booking.id)?.at(-1)).toMatchObject({
      provider: 'cash', status: 'authorized', amount: 12.35, currency: 'EUR', operatorId: 'desk-1', operatorName: 'Front Desk',
    });

    const cancelled = { ...state.booking, status: 'cancelled' as const };
    state.repository.getBookingByReference = async () => cancelled;
    const countBefore = state.attempts.get(state.booking.id)!.length;
    await expect(state.service.recordManualPayment(state.booking.reference, 'cash', 10)).resolves.toMatchObject({ outcome: 'cancelled' });
    expect(state.attempts.get(state.booking.id)).toHaveLength(countBefore);
  });

  it('records partial and full refunds within the same-currency authorized balance', async () => {
    const state = await confirmedState();
    await state.repository.savePaymentAttempt({ id: 'manual-payment', bookingId: state.booking.id, provider: 'cash', status: 'authorized', amount: 100, currency: 'EUR' });
    await state.repository.savePaymentAttempt({ id: 'pending-payment', bookingId: state.booking.id, provider: 'bank_transfer', status: 'demo_pending', amount: 500, currency: 'EUR' });
    await state.repository.savePaymentAttempt({ id: 'foreign-payment', bookingId: state.booking.id, provider: 'card', status: 'authorized', amount: 800, currency: 'USD' });
    await state.repository.savePaymentAttempt({ id: 'failed-payment', bookingId: state.booking.id, provider: 'card', status: 'failed', amount: 900, currency: 'EUR' });

    await expect(state.service.recordRefund(state.booking.reference, 'cash', 40, 13, ' service ', 'items', ['order:1'], ' guest request ', { id: 'owner', name: 'Owner' }))
      .resolves.toMatchObject({ outcome: 'recorded' });
    expect(state.attempts.get(state.booking.id)?.at(-1)).toMatchObject({
      amount: 40, vatRate: 13, comment: 'service', refundScope: 'items', refundItemIds: ['order:1'],
      refundReason: 'guest request', operatorId: 'owner', operatorName: 'Owner',
    });
    await expect(state.service.recordRefund(state.booking.reference, 'cash', 60, 0, '', 'full', [], ''))
      .resolves.toMatchObject({ outcome: 'recorded' });
    await expect(state.service.recordRefund(state.booking.reference, 'cash', 0.01, 0, '', 'full', [], ''))
      .resolves.toMatchObject({ outcome: 'exceeds_paid' });
  });

  it('keeps a committed refund when its follow-up notification fails', async () => {
    const serviceWithFailedNotice = setup({ afterRefundRecorded: async () => { throw new Error('notification offline'); } });
    const booked = await serviceWithFailedNotice.service.confirm(request('refund-notice-failure-key', 'pay_at_hotel'));
    await serviceWithFailedNotice.repository.savePaymentAttempt({ id: 'refund-notice-cash', bookingId: booked.id, provider: 'cash', status: 'authorized', amount: 50, currency: 'EUR' });
    await expect(serviceWithFailedNotice.service.recordRefund(booked.reference, 'cash', 25, 0, '', 'full', [], 'test'))
      .resolves.toMatchObject({ outcome: 'recorded' });
    expect(serviceWithFailedNotice.attempts.get(booked.id)?.filter((attempt) => attempt.status === 'refunded')).toHaveLength(1);
  });

  it('limits concurrent refunds to the remaining authorized balance', async () => {
    const state = await confirmedState();
    await state.repository.savePaymentAttempt({ id: 'paid-once', bookingId: state.booking.id, provider: 'cash', status: 'authorized', amount: 100, currency: 'EUR' });
    const outcomes = await Promise.all([
      state.service.recordRefund(state.booking.reference, 'cash', 70, 0, '', 'full', [], ''),
      state.service.recordRefund(state.booking.reference, 'cash', 70, 0, '', 'full', [], ''),
    ]);
    expect(outcomes.map((result) => result.outcome).sort()).toEqual(['exceeds_paid', 'recorded']);
    const refunded = state.attempts.get(state.booking.id)!.filter((attempt) => attempt.status === 'refunded');
    expect(refunded.reduce((sum, attempt) => sum + attempt.amount, 0)).toBe(70);
  });
});
