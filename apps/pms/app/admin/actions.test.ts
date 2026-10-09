import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  set: vi.fn(),
  member: null as null | { role: string; hotelIds?: string[] },
  revalidatePath: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: state.set }) }));
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
vi.mock('@/lib/application/admin-session', () => ({
  getAdminMember: () => Promise.resolve(state.member),
  requireBackOfficeSession: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock('@/lib/application/hotel-context', () => ({ getSelectedHotelSlug: vi.fn(), SELECTED_HOTEL_COOKIE: 'admin-hotel' }));
vi.mock('@/lib/application/container', () => ({
  availableHotels: [{ id: 'hotel_asteria', slug: 'asteria-cove' }, { id: 'hotel_harbor', slug: 'harbor-house' }],
  contentService: {}, demoControl: {}, sampleBookingService: {}, sampleDocumentService: {}, DEMO_HOTEL_SLUG: 'asteria-cove',
}));

import { setSelectedHotelAction } from './actions';

describe('hotel selection server action', () => {
  beforeEach(() => {
    state.set.mockReset();
    state.revalidatePath.mockReset();
  });

  it('does not write a cookie for a hotel outside a Hotelier assignment', async () => {
    state.member = { role: 'Hotelier', hotelIds: ['hotel_asteria'] };
    await setSelectedHotelAction('harbor-house');
    await setSelectedHotelAction('unknown-hotel');
    expect(state.set).not.toHaveBeenCalled();
  });

  it('writes only a known hotel that the signed-in Hotelier is assigned to', async () => {
    state.member = { role: 'Hotelier', hotelIds: ['hotel_asteria'] };
    await setSelectedHotelAction('asteria-cove');
    expect(state.set).toHaveBeenCalledWith('admin-hotel', 'asteria-cove', expect.objectContaining({ path: '/admin' }));
  });
});
