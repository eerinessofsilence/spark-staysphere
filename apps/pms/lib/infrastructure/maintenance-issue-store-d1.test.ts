import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaintenanceIssue, MaintenanceIssueNotification, MaintenanceReplacement } from '../domain/maintenance-issue';
import { createLibsqlD1 } from './libsql-d1';
import { maintenanceIssueStoreD1 as store } from './maintenance-issue-store-d1';

const binding = vi.hoisted(() => ({ db: null as D1Database | null }));
vi.mock('./cloudflare-env', () => ({ getDemoDatabase: () => binding.db }));

const now = '2026-10-08T10:00:00.000Z';
const issue: MaintenanceIssue = { id: 'issue-1', hotelId: 'hotel-1', unitId: 'unit-1', roomNumber: '101',
  category: 'Air Conditioning', description: 'Compressor is broken', reporterId: 'cleaner', reporterName: 'Cleaner',
  createdAt: now, updatedAt: now, status: 'Open', idempotencyKey: 'key-1', photos: [] };
const replacement: MaintenanceReplacement = { id: 'request-1', status: 'Pending', reason: 'Replace compressor',
  requestedById: 'owner', requestedByName: 'Owner', requestedAt: now, approvedById: null, approvedByName: null, approvedAt: null };
const notice: MaintenanceIssueNotification = { id: 'request-1:hotelier', hotelId: 'hotel-1', recipientId: 'hotelier',
  issueId: issue.id, title: 'Replacement Approval Required', message: 'Room 101: Replace compressor', createdAt: now, readAt: null };

beforeEach(() => { binding.db = createLibsqlD1(':memory:'); });

describe('durable replacement approval', () => {
  it('removes only the requested attachment in its hotel and leaves the issue intact', async () => {
    const photo = { id: 'private-photo', hotelId: issue.hotelId, issueId: issue.id, objectKey: 'photo.jpg', contentType: 'image/jpeg' as const };
    await store.create({ issue: { ...issue, photos: [photo] }, notifications: [] });
    expect(await store.removePhoto('other-hotel', issue.id, photo.id, now)).toBeNull();
    expect((await store.get(issue.hotelId, issue.id))?.photos).toHaveLength(1);
    expect((await store.removePhoto(issue.hotelId, issue.id, photo.id, now))?.photos).toEqual([]);
    expect((await store.removePhoto(issue.hotelId, issue.id, photo.id, now))?.status).toBe('Open');
  });
  it('upgrades existing photo records and retains the panorama type across reads', async () => {
    await binding.db!.prepare('CREATE TABLE maintenance_issue_photos (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, issue_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL)').run();
    const photo = { id: 'panorama', hotelId: issue.hotelId, issueId: issue.id, objectKey: 'panorama.jpg', contentType: 'image/jpeg' as const, view: '360' as const };
    await store.create({ issue: { ...issue, photos: [photo] }, notifications: [] });
    expect((await store.get(issue.hotelId, issue.id))?.photos[0]?.view).toBe('360');
    expect((await store.list(issue.hotelId))[0]?.photos[0]?.view).toBe('360');
  });
  it('keeps the attachment limit when batches race and accepts retries without duplicates', async () => {
    const attachment = (id: string) => ({ id, issueId: issue.id, hotelId: issue.hotelId, objectKey: `private/${id}.jpg`, contentType: 'image/jpeg' as const });
    await store.create({ issue: { ...issue, photos: [attachment('initial-1'), attachment('initial-2'), attachment('initial-3')] }, notifications: [] });
    const first = [attachment('first-1'), attachment('first-2')];
    const second = [attachment('second-1'), attachment('second-2')];
    const results = await Promise.all([store.addPhotos(issue.hotelId, issue.id, first, now), store.addPhotos(issue.hotelId, issue.id, second, now)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const saved = await store.get(issue.hotelId, issue.id);
    expect(saved?.photos).toHaveLength(5);
    const winner = saved!.photos.some((photo) => photo.id === first[0]!.id) ? first : second;
    expect((await store.addPhotos(issue.hotelId, issue.id, winner, now))?.photos).toHaveLength(5);
    expect(await store.addPhotos('other-hotel', issue.id, [attachment('foreign')], now)).toBeNull();
  });

  it('rolls back all new attachments when an insert fails', async () => {
    await store.create({ issue, notifications: [] });
    await binding.db!.prepare(`CREATE TRIGGER fail_photo BEFORE INSERT ON maintenance_issue_photos
      WHEN NEW.id = 'bad-photo' BEGIN SELECT RAISE(ABORT, 'test photo failure'); END`).run();
    const photos = ['first-photo', 'bad-photo'].map((id) => ({ id, hotelId: issue.hotelId, issueId: issue.id, objectKey: `${id}.jpg`, contentType: 'image/jpeg' as const }));
    await expect(store.addPhotos(issue.hotelId, issue.id, photos, now)).rejects.toThrow();
    expect((await store.get(issue.hotelId, issue.id))?.photos).toEqual([]);
  });

  it('persists the request and one notification when requests race, then records only the first approval', async () => {
    await store.create({ issue, notifications: [] });
    await Promise.all([
      store.requestReplacement(issue.hotelId, issue.id, replacement, [notice]),
      store.requestReplacement(issue.hotelId, issue.id, { ...replacement, id: 'request-2' }, [{ ...notice, id: 'request-2:hotelier' }]),
    ]);
    expect(await store.listNotifications(issue.hotelId, 'hotelier')).toHaveLength(1);
    expect((await store.list(issue.hotelId))[0]?.replacement).toMatchObject({ status: 'Pending', reason: replacement.reason });
    expect(await store.updateStatus(issue.hotelId, issue.id, 'Resolved', now)).toBeNull();
    await store.approveReplacement(issue.hotelId, issue.id, 'hotelier', 'Hotelier', now);
    await store.approveReplacement(issue.hotelId, issue.id, 'other', 'Other Hotelier', now);
    expect((await store.get(issue.hotelId, issue.id))?.replacement).toMatchObject({ status: 'Approved', approvedById: 'hotelier' });
    expect((await store.updateStatus(issue.hotelId, issue.id, 'Resolved', now))?.status).toBe('Resolved');
    expect(await store.get('other-hotel', issue.id)).toBeNull();
  });

  it('rolls back the replacement if notification insertion fails', async () => {
    await store.create({ issue, notifications: [] });
    await binding.db!.prepare(`CREATE TRIGGER fail_replacement_notice BEFORE INSERT ON maintenance_issue_notifications
      BEGIN SELECT RAISE(ABORT, 'test notification failure'); END`).run();
    await expect(store.requestReplacement(issue.hotelId, issue.id, replacement, [notice])).rejects.toThrow();
    expect((await store.get(issue.hotelId, issue.id))?.replacement).toBeNull();
    expect(await store.listNotifications(issue.hotelId, 'hotelier')).toEqual([]);
  });

  it('does not create a request or notice on a resolved issue or another hotel', async () => {
    await store.create({ issue: { ...issue, status: 'Resolved' }, notifications: [] });
    expect((await store.requestReplacement(issue.hotelId, issue.id, replacement, [notice]))?.replacement).toBeNull();
    expect(await store.requestReplacement('other-hotel', issue.id, replacement, [notice])).toBeNull();
    expect(await store.listNotifications(issue.hotelId, 'hotelier')).toEqual([]);
  });
});
