import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  slug: undefined as string | undefined,
  member: null as null | { role: string; hotelIds?: string[] },
  hotels: [
    { id: 'hotel_asteria', slug: 'asteria-cove' },
    { id: 'hotel_harbor', slug: 'harbor-house' },
  ],
}));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => state.slug ? { value: state.slug } : undefined })) }));
vi.mock('./container', () => ({
  availableHotels: state.hotels,
  DEMO_HOTEL_SLUG: 'asteria-cove',
}));
vi.mock('./admin-session', () => ({ getAdminMember: () => Promise.resolve(state.member) }));

import { getSelectedHotelSlug } from './hotel-context';

describe('selected hotel access boundary', () => {
  beforeEach(() => {
    state.slug = undefined;
    state.member = null;
  });

  it('lets a Hotelier select only an assigned hotel and ignores a forged cookie', async () => {
    state.member = { role: 'Hotelier', hotelIds: ['hotel_harbor'] };
    expect(await getSelectedHotelSlug()).toBe('harbor-house');

    state.slug = 'asteria-cove';
    expect(await getSelectedHotelSlug()).toBe('harbor-house');

    state.slug = 'unknown-slug';
    expect(await getSelectedHotelSlug()).toBe('harbor-house');

    state.slug = 'harbor-house';
    state.member = { role: 'Hotelier', hotelIds: ['hotel_asteria'] };
    expect(await getSelectedHotelSlug()).toBe('asteria-cove');
  });

  it('does not fall back to another hotel when a Hotelier has no assignments', async () => {
    state.member = { role: 'Hotelier', hotelIds: [] };
    state.slug = 'asteria-cove';
    expect(await getSelectedHotelSlug()).toBe('');
  });

  it('uses the default for non-Hotelier sessions and ignores unknown hotel slugs', async () => {
    state.member = { role: 'Owner' };
    expect(await getSelectedHotelSlug()).toBe('asteria-cove');
    state.slug = 'harbor-house';
    expect(await getSelectedHotelSlug()).toBe('harbor-house');
    state.slug = 'unknown-slug';
    expect(await getSelectedHotelSlug()).toBe('asteria-cove');
  });
});
