import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPublicBooking } = vi.hoisted(() => ({ createPublicBooking: vi.fn() }));
vi.mock('@/lib/application/pms-api', () => ({
  createPublicBooking,
  getPublicQuote: vi.fn(),
  PmsApiError: class extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
  },
}));

import { PmsApiError } from '@/lib/application/pms-api';
import { confirmBooking } from './actions';

const input = {
  roomSlug: 'deluxe-sea', checkIn: '2030-06-10', checkOut: '2030-06-11',
  adults: 2, children: 0, addOnIds: [],
  guest: { firstName: 'Ada', lastName: 'Lindqvist', email: 'ada@example.com', phone: '915550117' },
  expectedTotal: 200, paymentMethod: 'card' as const, idempotencyKey: 'retry-booking-123',
};

describe('booking confirmation failures', () => {
  beforeEach(() => vi.resetAllMocks());

  it('keeps a transport failure retryable with the original idempotency key', async () => {
    createPublicBooking.mockRejectedValueOnce(new PmsApiError('Temporarily unavailable', 503, 'unavailable'));
    createPublicBooking.mockResolvedValueOnce({ reference: 'ABC123' });
    await expect(confirmBooking(input)).resolves.toMatchObject({ ok: false, code: 'request_failed' });
    await expect(confirmBooking(input)).resolves.toEqual({ ok: true, reference: 'ABC123' });
    expect(createPublicBooking.mock.calls.map((call) => call[1])).toEqual([input.idempotencyKey, input.idempotencyKey]);
  });

  it('preserves a genuine room availability conflict', async () => {
    createPublicBooking.mockRejectedValueOnce(new PmsApiError('Room unavailable', 409, 'unavailable'));
    await expect(confirmBooking(input)).resolves.toMatchObject({ ok: false, code: 'unavailable' });
  });
});
