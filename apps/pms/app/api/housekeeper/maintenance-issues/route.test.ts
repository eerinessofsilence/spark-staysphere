import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  member: { id: 'housekeeper-1', name: 'Nina', role: 'Housekeeper', status: 'active' },
  requireSession: vi.fn(),
  findMember: vi.fn(),
  hasPermission: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
}));

vi.mock('@/lib/application/admin-session', () => ({
  AdminAuthError: class AdminAuthError extends Error {},
  requireAdminSession: state.requireSession,
}));
vi.mock('@/lib/application/container', () => ({
  availableHotels: [{ id: 'hotel_asteria', slug: 'asteria-cove' }],
  maintenanceIssueService: { create: state.create, listForHousekeeper: state.list },
  teamService: { findMemberById: state.findMember, hasPermission: state.hasPermission },
}));

import { AdminAuthError } from '@/lib/application/admin-session';
import { GET, POST } from './route';

function reportForm(file = new File([Uint8Array.from([1, 2, 3])], 'room.jpg', { type: 'image/jpeg' })) {
  const form = new FormData();
  form.set('hotelSlug', 'asteria-cove');
  form.set('unitId', 'room-205');
  form.set('category', 'Air Conditioning');
  form.set('description', 'The air conditioner is leaking.');
  form.set('idempotencyKey', 'maintenance-report-key-1');
  form.append('photos', file);
  return form;
}

describe('housekeeper maintenance HTTP contract', () => {
  beforeEach(() => {
    state.member = { id: 'housekeeper-1', name: 'Nina', role: 'Housekeeper', status: 'active' };
    state.requireSession.mockReset().mockResolvedValue({ memberId: 'housekeeper-1' });
    state.findMember.mockReset().mockImplementation(async () => state.member);
    state.hasPermission.mockReset().mockResolvedValue(true);
    state.create.mockReset().mockResolvedValue({ ok: true, created: true, notificationCount: 1, issue: { id: 'issue-1' } });
    state.list.mockReset().mockResolvedValue([]);
  });

  it('requires a signed-in Housekeeper with housekeeping permission to read assigned reports', async () => {
    state.requireSession.mockRejectedValueOnce(new AdminAuthError());
    const unauthorized = await GET(new Request('http://pms.test/api/housekeeper/maintenance-issues?hotel=asteria-cove'));
    expect(unauthorized.status).toBe(401);

    state.member = { ...state.member, role: 'Hotelier' };
    const forbidden = await GET(new Request('http://pms.test/api/housekeeper/maintenance-issues?hotel=asteria-cove'));
    expect(forbidden.status).toBe(403);
    expect(state.list).not.toHaveBeenCalled();

    state.member = { ...state.member, role: 'Housekeeper' };
    state.list.mockResolvedValueOnce([{ id: 'issue-1' }]);
    const allowed = await GET(new Request('http://pms.test/api/housekeeper/maintenance-issues?hotel=asteria-cove'));
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ issues: [{ id: 'issue-1' }] });
    expect(state.list).toHaveBeenCalledWith('asteria-cove', state.member);
  });

  it('accepts a valid multipart report and forwards its access and idempotency data', async () => {
    const response = await POST(new Request('http://pms.test/api/housekeeper/maintenance-issues', {
      method: 'POST', body: reportForm(),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ issueId: 'issue-1', created: true, notificationCount: 1 });
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      hotelSlug: 'asteria-cove', unitId: 'room-205', idempotencyKey: 'maintenance-report-key-1',
      reporter: state.member, photos: [expect.objectContaining({ contentType: 'image/jpeg', view: 'photo' })],
    }));
    expect(new Uint8Array(state.create.mock.calls[0]![0].photos[0].bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects a non-Housekeeper, invalid attachment, and cross-origin multipart write', async () => {
    state.member = { ...state.member, role: 'Owner' };
    const wrongRole = await POST(new Request('http://pms.test/api/housekeeper/maintenance-issues', { method: 'POST', body: reportForm() }));
    expect(wrongRole.status).toBe(403);

    state.member = { ...state.member, role: 'Housekeeper' };
    const invalidPhoto = await POST(new Request('http://pms.test/api/housekeeper/maintenance-issues', {
      method: 'POST', body: reportForm(new File(['text'], 'bad.txt', { type: 'text/plain' })),
    }));
    expect(invalidPhoto.status).toBe(400);
    expect(state.create).not.toHaveBeenCalled();

    const crossOrigin = await POST(new Request('http://pms.test/api/housekeeper/maintenance-issues', {
      method: 'POST', headers: { origin: 'http://evil.test' }, body: reportForm(),
    }));
    expect(crossOrigin.status).toBe(403);
    expect(state.create).not.toHaveBeenCalled();
  });
});
