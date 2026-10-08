import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ verify: vi.fn(), listTrips: vi.fn() }));
vi.mock('@/lib/application/admin-session', () => ({
  verifyBookingConfirmationAccessToken: state.verify,
  createBookingConfirmationAccessToken: vi.fn(),
}));
vi.mock('@/lib/application/container', () => ({
  bookingService: { listTrips: state.listTrips },
  DEMO_HOTEL_SLUG: 'asteria-cove',
  sampleBookingService: { listShowcase: vi.fn() },
}));
vi.mock('@/lib/application/assistant-rate-limit', () => ({ checkRateLimit: () => true, clientKeyFromHeaders: () => 'test' }));

import { POST } from './route';

describe('private trip list contract', () => {
  beforeEach(() => {
    state.verify.mockReset();
    state.listTrips.mockReset();
  });

  it('does not reveal any trip for a forged, expired, or reference-mismatched token', async () => {
    state.verify.mockResolvedValue(false);
    state.listTrips.mockImplementation(async (references: string[]) => references.map((reference) => ({ reference, guestEmail: 'private@example.test' })));
    const response = await POST(new Request('http://pms.test/api/public/trips', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'list', entries: [{ reference: 'ABC123', token: 'forged-token' }] }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ trips: [] });
    expect(state.listTrips).toHaveBeenCalledWith([]);
  });
});
