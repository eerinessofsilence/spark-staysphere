import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ set: vi.fn(), forward: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: async () => ({ set: state.set }) }));
vi.mock('@/lib/application/pms-api', () => ({ forwardPmsRequest: state.forward }));

import { POST } from './route';

describe('Guest booking compatibility route', () => {
  beforeEach(() => {
    state.set.mockReset();
    state.forward.mockReset();
  });

  it('forwards the idempotency key and creates an access cookie only for a successful booking', async () => {
    state.forward.mockResolvedValueOnce(Response.json({
      booking: { reference: 'ABC123', guestEmail: 'ada@example.test' }, confirmationAccessToken: 'signed-token',
    }, { status: 201 }));
    const response = await POST(new Request('http://guest.test/api/bookings', {
      method: 'POST', headers: { 'Idempotency-Key': 'stable-key', 'content-type': 'application/json' }, body: '{"roomSlug":"deluxe-sea"}',
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ booking: { reference: 'ABC123', guestEmail: 'ada@example.test' } });
    expect(state.forward).toHaveBeenCalledWith('/api/bookings', expect.objectContaining({
      method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': 'stable-key' },
    }));
    expect(state.set).toHaveBeenCalledWith('pms-booking-access-ABC123', 'signed-token', expect.objectContaining({ httpOnly: true, path: '/' }));
  });

  it('does not create an access cookie for a failed or incomplete upstream response', async () => {
    state.forward.mockResolvedValueOnce(Response.json({ error: 'payment_declined' }, { status: 402 }));
    expect((await POST(new Request('http://guest.test/api/bookings', { method: 'POST', body: '{}' }))).status).toBe(402);
    state.forward.mockResolvedValueOnce(Response.json({ booking: { reference: 'ABC123' } }, { status: 201 }));
    expect((await POST(new Request('http://guest.test/api/bookings', { method: 'POST', body: '{}' }))).status).toBe(201);
    expect(state.set).not.toHaveBeenCalled();
  });
});
