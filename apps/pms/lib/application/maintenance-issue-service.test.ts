import { describe, expect, it, vi } from 'vitest';
import type { MaintenanceIssue, MaintenanceIssueNotification, MaintenanceIssueStatus, MaintenanceIssueStore } from '../domain/maintenance-issue';
import type { TeamMember } from './team-directory';
import { MaintenanceIssueService } from './maintenance-issue-service';

const hotelier: TeamMember = { id: 'manager-1', name: 'Hotelier', email: 'hotel@example.test', role: 'Hotelier', status: 'active', lastActive: 'team.notSignedIn', hotelIds: ['hotel-1'] };
const housekeeper: TeamMember = { id: 'cleaner-1', name: 'Housekeeper', email: 'cleaner@example.test', role: 'Housekeeper', status: 'active', lastActive: 'team.notSignedIn' };
const photo = { bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0, 0xff, 0xd9]).buffer, contentType: 'image/jpeg' };

function setup() {
  const issues = new Map<string, MaintenanceIssue>();
  const notices = new Map<string, MaintenanceIssueNotification>();
  const store: MaintenanceIssueStore = {
    async removePhoto(hotelId, issueId, photoId, updatedAt) {
      const issue = issues.get(issueId);
      if (!issue || issue.hotelId !== hotelId) return null;
      const updated = { ...issue, photos: issue.photos.filter((photo) => photo.id !== photoId), updatedAt };
      issues.set(issueId, updated); return updated;
    },
    async findByIdempotencyKey(hotelId, reporterId, key) {
      return [...issues.values()].find((issue) => issue.hotelId === hotelId && issue.reporterId === reporterId && issue.idempotencyKey === key) ?? null;
    },
    async create({ issue, notifications }) {
      const prior = [...issues.values()].find((candidate) => candidate.hotelId === issue.hotelId && candidate.reporterId === issue.reporterId && candidate.idempotencyKey === issue.idempotencyKey);
      if (prior) return { issue: prior, created: false };
      issues.set(issue.id, issue);
      notifications.forEach((notice) => notices.set(notice.id, notice));
      return { issue, created: true };
    },
    async get(hotelId, issueId) { const issue = issues.get(issueId); return issue?.hotelId === hotelId ? issue : null; },
    async list(hotelId) { return [...issues.values()].filter((issue) => issue.hotelId === hotelId); },
    async addPhotos(hotelId, issueId, photos, updatedAt) {
      const issue = issues.get(issueId);
      if (!issue || issue.hotelId !== hotelId) return null;
      const added = photos.filter((photo) => !issue.photos.some((saved) => saved.id === photo.id));
      if (issue.photos.length + added.length > 5) return null;
      const updated = { ...issue, photos: [...issue.photos, ...added], updatedAt };
      issues.set(issueId, updated); return updated;
    },
    async updateStatus(hotelId, issueId, status: MaintenanceIssueStatus, updatedAt) {
      const issue = issues.get(issueId);
      if (!issue || issue.hotelId !== hotelId || (status === 'Resolved' && issue.replacement?.status === 'Pending')) return null;
      const updated = { ...issue, status, updatedAt }; issues.set(issueId, updated); return updated;
    },
    async requestReplacement(hotelId, issueId, replacement, notifications) {
      const issue = issues.get(issueId);
      if (!issue || issue.hotelId !== hotelId || issue.status === 'Resolved') return null;
      if (issue.replacement) return issue;
      const updated = { ...issue, replacement, updatedAt: replacement.requestedAt };
      issues.set(issueId, updated); notifications.forEach((notice) => notices.set(notice.id, notice));
      return updated;
    },
    async approveReplacement(hotelId, issueId, approverId, approverName, approvedAt) {
      const issue = issues.get(issueId);
      if (!issue || issue.hotelId !== hotelId || !issue.replacement) return null;
      if (issue.replacement.status === 'Approved') return issue;
      const updated: MaintenanceIssue = { ...issue, updatedAt: approvedAt,
        replacement: { ...issue.replacement, status: 'Approved', approvedById: approverId, approvedByName: approverName, approvedAt } };
      issues.set(issueId, updated); return updated;
    },
    async listNotifications(hotelId, recipientId) { return [...notices.values()].filter((notice) => notice.hotelId === hotelId && notice.recipientId === recipientId); },
    async markNotificationsRead(hotelId, recipientId, issueId, readAt) {
      for (const [id, notice] of notices) if (notice.hotelId === hotelId && notice.recipientId === recipientId && notice.issueId === issueId) notices.set(id, { ...notice, readAt });
    },
  };
  const uploaded = new Map<string, ArrayBuffer>();
  const storage = {
    async put(key: string, bytes: ArrayBuffer) { uploaded.set(key, bytes); },
    async get(key: string) { const body = uploaded.get(key); return body ? { body, contentType: 'image/jpeg' } : null; },
    async delete(keys: string[]) { keys.forEach((key) => uploaded.delete(key)); },
  };
  const setStatus = vi.fn();
  const team = {
    async listMembers(): Promise<TeamMember[]> { return [hotelier]; },
    async hasPermission() { return true; },
  };
  const service = new MaintenanceIssueService(
    store,
    storage,
    { async getHotel(slug: string) { return { id: slug === 'asteria' ? 'hotel-1' : 'hotel-2' } as never; } },
    { async listPhysicalRooms(hotelId: string) { return hotelId === 'hotel-1' ? [{ id: 'room-205', number: '205' }, { id: 'room-206', number: '206' }] as never : []; } },
    { async listAssignments() { return [{ hotelId: 'hotel-1', unitId: 'room-205', memberId: housekeeper.id }]; }, setStatus } as never,
    team,
    { now: () => new Date('2026-10-08T10:00:00.000Z') },
  );
  return { service, store, storage, uploaded, setStatus, team };
}

function input(overrides: Partial<Parameters<MaintenanceIssueService['create']>[0]> = {}) {
  return { hotelSlug: 'asteria', unitId: 'room-205', category: 'Air Conditioning', description: '', reporter: housekeeper,
    idempotencyKey: '70aa8a74-0ec0-4b60-8abd-793ce8d23eb1', photos: [photo], ...overrides };
}

describe('MaintenanceIssueService', () => {
  it('removes saved attachments only for managers of the hotel and makes the old URL unavailable', async () => {
    const { service, uploaded } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    const id = created.issue.photos[0]!.id;
    expect(await service.removePhoto('hotel-1', created.issue.id, id, housekeeper)).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await service.removePhoto('hotel-1', created.issue.id, id, { ...hotelier, hotelIds: ['hotel-2'] })).toMatchObject({ ok: false, error: 'forbidden' });
    expect(uploaded.size).toBe(1);
    expect(await service.removePhoto('hotel-1', created.issue.id, id, hotelier)).toMatchObject({ ok: true, issue: { photos: [] } });
    expect(uploaded.size).toBe(0);
    expect(await service.readPhoto('hotel-1', created.issue.id, id, hotelier)).toBeNull();
    expect(await service.removePhoto('hotel-1', created.issue.id, id, hotelier)).toMatchObject({ ok: true });
  });
  it('accepts a 2:1 panorama and preserves its view while rejecting a flat image marked as 360', async () => {
    const { service, uploaded } = setup();
    expect(await service.create(input({ photos: [{ ...photo, view: '360' }] }))).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(uploaded.size).toBe(0);
    const bytes = new Uint8Array(photo.bytes.slice(0)); bytes[10] = 2;
    const result = await service.create(input({ photos: [{ bytes: bytes.buffer, contentType: 'image/jpeg', view: '360' }] }));
    expect(result).toMatchObject({ ok: true, issue: { photos: [{ view: '360' }] } });
  });
  it('adds private photos once and makes them readable only to hotel managers', async () => {
    const { service, uploaded } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    const request = { hotelId: 'hotel-1', issueId: created.issue.id, member: hotelier,
      idempotencyKey: 'deab8a74-0ec0-4b60-8abd-793ce8d23eb1', photos: [photo, photo] };
    const results = await Promise.all([service.addPhotos(request), service.addPhotos(request)]);
    expect(results.every((result) => result.ok)).toBe(true);
    const saved = await service.getForHotelier('hotel-1', created.issue.id, hotelier);
    expect(saved?.photos).toHaveLength(3);
    expect(uploaded.size).toBe(3);
    const attachment = saved!.photos[1]!;
    expect(await service.readPhoto('hotel-1', saved!.id, attachment.id, hotelier)).toMatchObject({ contentType: 'image/jpeg' });
    expect(await service.readPhoto('hotel-1', saved!.id, attachment.id, { ...hotelier, hotelIds: ['hotel-2'] })).toBeNull();
    expect(await service.addPhotos({ ...request, member: housekeeper })).toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('rejects excess or invalid attachments without uploading them', async () => {
    const { service, uploaded } = setup();
    const created = await service.create(input({ photos: [photo, photo, photo, photo] }));
    if (!created.ok) throw new Error('expected issue creation');
    const request = { hotelId: 'hotel-1', issueId: created.issue.id, member: hotelier,
      idempotencyKey: 'deab8a74-0ec0-4b60-8abd-793ce8d23eb1', photos: [photo, photo] };
    expect(await service.addPhotos(request)).toMatchObject({ ok: false, error: 'photoLimit' });
    expect(await service.addPhotos({ ...request, photos: [{ ...photo, contentType: 'image/png' }] })).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(uploaded.size).toBe(4);
  });

  it('preserves committed evidence when adding photos loses its acknowledgement', async () => {
    const { service, store, uploaded } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    const addPhotos = store.addPhotos.bind(store);
    vi.spyOn(store, 'addPhotos').mockImplementation(async (...args) => {
      await addPhotos(...args); throw new Error('lost acknowledgement');
    });
    const result = await service.addPhotos({ hotelId: 'hotel-1', issueId: created.issue.id, member: hotelier,
      idempotencyKey: 'deab8a74-0ec0-4b60-8abd-793ce8d23eb1', photos: [photo] });
    expect(result).toMatchObject({ ok: true });
    expect(uploaded.size).toBe(2);
  });

  it('notifies hoteliers once for replacement and requires explicit approval before fixing', async () => {
    const { service, store } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    const owner: TeamMember = { ...hotelier, id: 'owner', name: 'Owner', role: 'Owner' };
    const requests = await Promise.all([
      service.requestReplacement('hotel-1', created.issue.id, 'Replace the compressor', owner),
      service.requestReplacement('hotel-1', created.issue.id, 'Replace the compressor', owner),
    ]);
    expect(requests.every((result) => result.ok)).toBe(true);
    const notices = await store.listNotifications('hotel-1', hotelier.id);
    expect(notices.filter((notice) => notice.title === 'Replacement Approval Required')).toHaveLength(1);
    await service.markIssueNotificationsRead('hotel-1', created.issue.id, hotelier);
    expect((await service.getForHotelier('hotel-1', created.issue.id, hotelier))?.replacement?.status).toBe('Pending');
    expect(await service.updateStatus('hotel-1', created.issue.id, 'Resolved', owner)).toBeNull();
    expect(await service.approveReplacement('hotel-1', created.issue.id, owner)).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await service.approveReplacement('hotel-1', created.issue.id, hotelier)).toMatchObject({
      ok: true, issue: { status: 'Open', replacement: { status: 'Approved', approvedById: hotelier.id } },
    });
    expect((await service.updateStatus('hotel-1', created.issue.id, 'Resolved', owner))?.status).toBe('Resolved');
  });

  it('rejects replacement approval by unassigned, inactive, and unauthorized staff', async () => {
    const { service, team } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    await service.requestReplacement('hotel-1', created.issue.id, 'Replace the compressor', hotelier);
    for (const member of [housekeeper, { ...hotelier, hotelIds: ['hotel-2'] }, { ...hotelier, status: 'invited' as const }]) {
      expect(await service.approveReplacement('hotel-1', created.issue.id, member)).toMatchObject({ ok: false, error: 'forbidden' });
    }
    expect(await service.requestReplacement('hotel-2', created.issue.id, 'Replace it', hotelier)).toMatchObject({ ok: false, error: 'forbidden' });
    vi.spyOn(team, 'hasPermission').mockResolvedValue(false);
    expect(await service.approveReplacement('hotel-1', created.issue.id, hotelier)).toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('does not leave a replacement request waiting when no eligible hotelier exists', async () => {
    const { service, store, team } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    vi.spyOn(team, 'listMembers').mockResolvedValue([{ ...hotelier, hotelIds: ['hotel-2'] }, { ...hotelier, id: 'invited', status: 'invited' }]);
    expect(await service.requestReplacement('hotel-1', created.issue.id, 'Replace it', hotelier)).toMatchObject({ ok: false, error: 'noHotelier' });
    expect((await store.get('hotel-1', created.issue.id))?.replacement).toBeUndefined();
    expect(await service.requestReplacement('hotel-1', created.issue.id, ' ', hotelier)).toMatchObject({ ok: false, error: 'invalidInput' });
    await service.updateStatus('hotel-1', created.issue.id, 'Resolved', hotelier);
    expect(await service.requestReplacement('hotel-1', created.issue.id, 'Replace it', hotelier)).toMatchObject({ ok: false, error: 'resolved' });
  });

  it('creates an open room issue, attaches private photos, and notifies assigned hoteliers without changing housekeeping', async () => {
    const { service, uploaded, store, setStatus } = setup();
    const result = await service.create(input());
    expect(result).toMatchObject({ ok: true, created: true, notificationCount: 1, issue: { roomNumber: '205', status: 'Open', category: 'Air Conditioning' } });
    if (!result.ok) throw new Error('expected issue creation');
    expect(result.issue.photos).toHaveLength(1);
    expect(uploaded.size).toBe(1);
    expect(await store.listNotifications('hotel-1', hotelier.id)).toHaveLength(1);
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('rejects unauthorized roles and rooms not assigned to the reporter', async () => {
    const { service } = setup();
    expect(await service.create(input({ reporter: { ...hotelier, role: 'Front desk' } }))).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await service.create(input({ reporter: { ...housekeeper, status: 'invited' } }))).toMatchObject({ ok: false, error: 'forbidden' });
    const wrongRoom = await service.create(input({ unitId: 'room-999' }));
    expect(wrongRoom).toMatchObject({ ok: false, error: 'roomNotFound' });
    expect(await service.create(input({ unitId: 'room-206' }))).toMatchObject({ ok: false, error: 'notAssigned' });
  });

  it('keeps hotel issue reads and updates isolated', async () => {
    const { service } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    expect(await service.getForHotelier('hotel-2', created.issue.id, hotelier)).toBeNull();
    expect(await service.updateStatus('hotel-2', created.issue.id, 'Resolved', hotelier)).toBeNull();
    expect(await service.getForHotelier('hotel-1', created.issue.id, { ...hotelier, hotelIds: ['hotel-2'] })).toBeNull();
  });

  it('uses a persistent in-app notification and scopes it to Hotelier membership', async () => {
    const { service } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    expect(await service.listNotifications('hotel-1', hotelier)).toHaveLength(1);
    expect(await service.listNotifications('hotel-2', hotelier)).toEqual([]);
    await service.markIssueNotificationsRead('hotel-1', created.issue.id, hotelier);
    expect((await service.listNotifications('hotel-1', hotelier))[0]?.readAt).toBe('2026-10-08T10:00:00.000Z');
  });

  it('allows Owner and assigned Hotelier to report rooms without a housekeeping assignment', async () => {
    const { service } = setup();
    expect(await service.create(input({ unitId: 'room-206', reporter: hotelier }))).toMatchObject({ ok: true, issue: { status: 'Open', reporterId: hotelier.id } });
    expect(await service.create(input({ unitId: 'room-206', reporter: { ...hotelier, id: 'owner', role: 'Owner', hotelIds: [] } }))).toMatchObject({ ok: true });
    expect(await service.create(input({ reporter: { ...hotelier, hotelIds: ['hotel-2'] } }))).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await service.create(input({ reporter: { ...hotelier, status: 'invited' } }))).toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('prevents duplicate submissions for the same reporter and idempotency key', async () => {
    const { service, storage, uploaded } = setup();
    const first = await service.create(input());
    const upload = vi.spyOn(storage, 'put');
    const second = await service.create(input());
    expect(first.ok && second.ok && second.created).toBe(false);
    expect(first.ok && second.ok ? second.issue.id : null).toBe(first.ok ? first.issue.id : null);
    expect(uploaded.size).toBe(1);
    expect(upload).not.toHaveBeenCalled();
  });

  it('lists only the authorized hotel and rejects an invalid status at runtime', async () => {
    const { service } = setup();
    const created = await service.create(input());
    if (!created.ok) throw new Error('expected issue creation');
    expect(await service.listForHotelier('hotel-1', hotelier)).toHaveLength(1);
    expect(await service.listForHotelier('hotel-2', hotelier)).toEqual([]);
    expect(await service.listForHotelier('hotel-1', housekeeper)).toEqual([]);
    expect(await service.updateStatus('hotel-1', created.issue.id, 'invalid' as MaintenanceIssueStatus, hotelier)).toBeNull();
    expect((await service.getForHotelier('hotel-1', created.issue.id, hotelier))?.status).toBe('Open');
  });

  it('keeps multiple photos private and preserves housekeeping through every issue status', async () => {
    const { service, uploaded, setStatus } = setup();
    const created = await service.create(input({ photos: [photo, photo] }));
    if (!created.ok) throw new Error('expected issue creation');
    expect(created.issue.photos).toHaveLength(2);
    expect(uploaded.size).toBe(2);
    const photoId = created.issue.photos[0]!.id;
    expect(await service.readPhoto('hotel-1', created.issue.id, photoId, hotelier)).not.toBeNull();
    expect(await service.readPhoto('hotel-2', created.issue.id, photoId, hotelier)).toBeNull();
    expect(await service.readPhoto('hotel-1', created.issue.id, photoId, housekeeper)).toBeNull();
    for (const status of ['In Progress', 'Resolved', 'Open'] as const) {
      expect((await service.updateStatus('hotel-1', created.issue.id, status, hotelier))?.status).toBe(status);
    }
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('only notifies active Hotelier accounts assigned to the reported hotel', async () => {
    const { service, store, team } = setup();
    vi.spyOn(team, 'listMembers').mockResolvedValue([
      hotelier,
      { ...hotelier, id: 'invited', status: 'invited' },
      { ...hotelier, id: 'different-hotel', hotelIds: ['hotel-2'] },
      { ...hotelier, id: 'front-desk', role: 'Front desk' },
    ]);
    const result = await service.create(input());
    expect(result).toMatchObject({ ok: true, notificationCount: 1 });
    for (const recipientId of ['invited', 'different-hotel', 'front-desk']) {
      expect(await store.listNotifications('hotel-1', recipientId)).toEqual([]);
    }
  });

  it('rejects revoked housekeeping permission before uploading photos', async () => {
    const { service, team, uploaded } = setup();
    vi.spyOn(team, 'hasPermission').mockResolvedValue(false);
    expect(await service.create(input())).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await service.listForHotelier('hotel-1', hotelier)).toEqual([]);
    expect(uploaded.size).toBe(0);
  });

  it('cleans up the losing upload when two submissions race', async () => {
    const { service, uploaded, store } = setup();
    const results = await Promise.all([service.create(input()), service.create(input())]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.filter((result) => result.ok && result.created)).toHaveLength(1);
    expect(uploaded.size).toBe(1);
    expect(await store.list('hotel-1')).toHaveLength(1);
    expect(await store.listNotifications('hotel-1', hotelier.id)).toHaveLength(1);
  });

  it('rejects missing, invalid, and oversized photo attachments', async () => {
    const { service, uploaded } = setup();
    expect(await service.create(input({ photos: [] }))).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(await service.create(input({ photos: [{ ...photo, contentType: 'image/png' }] }))).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(await service.create(input({ photos: [{ bytes: new ArrayBuffer(700_001), contentType: 'image/jpeg' }] }))).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(uploaded.size).toBe(0);
  });

  it('preserves attached evidence when the database reply fails after saving', async () => {
    const { service, store, uploaded } = setup();
    const save = store.create.bind(store);
    vi.spyOn(store, 'create').mockImplementation(async (value) => {
      await save(value);
      throw new Error('reply interrupted after commit');
    });
    const result = await service.create(input());
    expect(result).toMatchObject({ ok: true, created: false });
    expect(uploaded.size).toBe(1);
    expect(await store.listNotifications('hotel-1', hotelier.id)).toHaveLength(1);
  });

  it('reports a notification save failure instead of claiming successful delivery', async () => {
    const { service, store, uploaded } = setup();
    vi.spyOn(store, 'create').mockRejectedValue(new Error('notification write failed'));
    expect(await service.create(input())).toMatchObject({ ok: false, error: 'storageUnavailable' });
    expect(uploaded.size).toBe(0);
    expect(await store.listNotifications('hotel-1', hotelier.id)).toEqual([]);
  });
});
