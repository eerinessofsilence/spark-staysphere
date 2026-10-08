import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  setCookie: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env: {} }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => state.cookies.has(name) ? { value: state.cookies.get(name) } : undefined,
    set: (name: string, value: string) => state.setCookie(name, value),
  }),
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.9' }),
}));

import {
  createPublicBooking,
  getPublicBookingConfirmation,
  getPublicQuote,
  PmsApiError,
} from './pms-api';

describe('Guest to PMS API boundary', () => {
  beforeEach(() => {
    state.cookies.clear();
    state.setCookie.mockClear();
    state.setCookie.mockImplementation((name: string, value: string) => state.cookies.set(name, value));
    state.fetch.mockReset();
    vi.stubGlobal('fetch', state.fetch);
  });

  it('maps a network failure to a retryable unavailable error', async () => {
    state.fetch.mockRejectedValueOnce(new Error('connection refused'));
    await expect(getPublicQuote({ roomSlug: 'deluxe-sea', checkIn: '2030-01-01', checkOut: '2030-01-02', adults: 2, children: 0, addOnIds: [] }))
      .rejects.toMatchObject({ name: 'PmsApiError', status: 503, code: 'unavailable' });
  });

  it.each([400, 404, 409, 429, 503])('preserves HTTP %i and structured price/form details', async (status) => {
    state.fetch.mockResolvedValueOnce(Response.json({
      error: status === 409 ? 'price_changed' : 'validation_failed',
      message: 'Please check your booking.',
      currentTotal: 321.45,
      fieldErrors: { email: ['Enter a valid email.'] },
    }, { status }));
    try {
      await getPublicQuote({ roomSlug: 'deluxe-sea', checkIn: '2030-01-01', checkOut: '2030-01-02', adults: 2, children: 0, addOnIds: [] });
      throw new Error('expected request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PmsApiError);
      expect(error).toMatchObject({ status, currentTotal: 321.45, fieldErrors: { email: ['Enter a valid email.'] } });
    }
  });

  it('turns malformed successful JSON into a typed upstream error', async () => {
    state.fetch.mockResolvedValueOnce(new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(getPublicQuote({ roomSlug: 'deluxe-sea', checkIn: '2030-01-01', checkOut: '2030-01-02', adults: 2, children: 0, addOnIds: [] }))
      .rejects.toMatchObject({ status: 502, code: 'invalid_response' });
  });

  it('forwards idempotency and client IP, and stores booking access only after success', async () => {
    const input = {
      roomSlug: 'deluxe-sea', checkIn: '2030-01-01', checkOut: '2030-01-02', adults: 2, children: 0, addOnIds: [],
      guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', phone: '+10000000000' },
      expectedTotal: 321.45, paymentMethod: 'card',
    };
    state.fetch.mockResolvedValueOnce(Response.json({ booking: { reference: 'ABC123' }, confirmationAccessToken: 'signed-access' }));
    await expect(createPublicBooking(input, 'idem-booking-1')).resolves.toMatchObject({ reference: 'ABC123' });
    const [url, init] = state.fetch.mock.calls[0]!;
    expect(url).toContain('/api/bookings');
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('idem-booking-1');
    expect(new Headers(init.headers).get('cf-connecting-ip')).toBe('203.0.113.9');
    expect(state.cookies.get('pms-booking-access-ABC123')).toBe('signed-access');

    state.cookies.clear();
    state.fetch.mockResolvedValueOnce(Response.json({ error: 'payment_declined' }, { status: 402 }));
    await expect(createPublicBooking(input, 'idem-booking-2')).rejects.toMatchObject({ status: 402 });
    expect(state.setCookie).toHaveBeenCalledTimes(1);
  });

  it('uses the saved access cookie as a Bearer token for confirmation reads', async () => {
    state.cookies.set('pms-booking-access-ABC123', 'confirmation-signed-token');
    state.fetch.mockResolvedValueOnce(Response.json({ confirmation: { reference: 'ABC123' } }));
    await expect(getPublicBookingConfirmation('ABC123')).resolves.toMatchObject({ reference: 'ABC123' });
    const [, init] = state.fetch.mock.calls[0]!;
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer confirmation-signed-token');

    state.fetch.mockReset();
    state.cookies.clear();
    await expect(getPublicBookingConfirmation('ABC123')).rejects.toMatchObject({ status: 404, code: 'not_found' });
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
