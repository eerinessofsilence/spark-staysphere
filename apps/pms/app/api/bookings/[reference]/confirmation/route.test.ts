import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ verify: vi.fn(), getConfirmation: vi.fn() }));
vi.mock('@/lib/application/admin-session', () => ({ verifyBookingConfirmationAccessToken: state.verify }));
vi.mock('@/lib/application/container', () => ({ bookingService: { getConfirmation: state.getConfirmation } }));

import { GET } from './route';

describe('booking confirmation HTTP access contract', () => {
  beforeEach(() => {
    state.verify.mockReset();
    state.getConfirmation.mockReset();
  });

  it('does not disclose a booking when the signed token is missing or invalid', async () => {
    state.verify.mockResolvedValue(false);
    const response = await GET(new Request('http://pms.test/api/bookings/ABC123/confirmation'), {
      params: Promise.resolve({ reference: 'ABC123' }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'not_found' });
    expect(state.getConfirmation).not.toHaveBeenCalled();
  });

  it('passes the token and reference through verification before revealing confirmation data', async () => {
    state.verify.mockResolvedValue(true);
    state.getConfirmation.mockResolvedValue({ reference: 'ABC123', guest: { email: 'ada@example.test' } });
    const response = await GET(new Request('http://pms.test/api/bookings/ABC123/confirmation', {
      headers: { authorization: 'Bearer signed-booking-token' },
    }), { params: Promise.resolve({ reference: 'ABC123' }) });
    expect(state.verify).toHaveBeenCalledWith('ABC123', 'signed-booking-token');
    expect(await response.json()).toMatchObject({ confirmation: { reference: 'ABC123' } });
  });
});
