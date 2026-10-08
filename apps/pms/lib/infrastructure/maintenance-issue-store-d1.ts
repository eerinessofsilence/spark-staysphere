import type {
  MaintenanceIssue,
  MaintenanceIssueNotification,
  MaintenanceIssuePhoto,
  MaintenanceIssueStatus,
  MaintenanceIssueStore,
  MaintenanceReplacement,
} from '../domain/maintenance-issue';
import { ensureSchema } from './d1-schema';
import { getDemoDatabase } from './cloudflare-env';

interface IssueRow {
  id: string; hotel_id: string; unit_id: string; room_number: string; category: MaintenanceIssue['category'];
  description: string | null; reporter_id: string; reporter_name: string; created_at: string;
  updated_at: string; status: MaintenanceIssueStatus; idempotency_key: string;
}

interface PhotoRow { id: string; issue_id: string; hotel_id: string; object_key: string; content_type: 'image/jpeg'; view_type: 'photo' | '360' }
interface NotificationRow {
  id: string; hotel_id: string; recipient_id: string; issue_id: string; title: MaintenanceIssueNotification['title'];
  message: string; created_at: string; read_at: string | null;
}

interface ReplacementRow {
  id: string; issue_id: string; status: MaintenanceReplacement['status']; reason: string;
  requested_by_id: string; requested_by_name: string; requested_at: string;
  approved_by_id: string | null; approved_by_name: string | null; approved_at: string | null;
}

function toReplacement(row: ReplacementRow): MaintenanceReplacement {
  return { id: row.id, status: row.status, reason: row.reason, requestedById: row.requested_by_id,
    requestedByName: row.requested_by_name, requestedAt: row.requested_at,
    approvedById: row.approved_by_id, approvedByName: row.approved_by_name, approvedAt: row.approved_at };
}

async function replacementFor(db: D1Database, hotelId: string, issueId: string): Promise<MaintenanceReplacement | null> {
  const row = await db.prepare('SELECT * FROM maintenance_issue_replacements WHERE hotel_id = ? AND issue_id = ?')
    .bind(hotelId, issueId).first<ReplacementRow>();
  return row ? toReplacement(row) : null;
}

async function issueById(db: D1Database, hotelId: string, issueId: string): Promise<MaintenanceIssue | null> {
  const row = await db.prepare('SELECT * FROM maintenance_issues WHERE hotel_id = ? AND id = ?').bind(hotelId, issueId).first<IssueRow>();
  return row ? toIssue(row, await photosFor(db, hotelId, issueId), await replacementFor(db, hotelId, issueId)) : null;
}

function toPhoto(row: PhotoRow): MaintenanceIssuePhoto {
  return { id: row.id, issueId: row.issue_id, hotelId: row.hotel_id, objectKey: row.object_key, contentType: row.content_type, view: row.view_type ?? 'photo' };
}

function toNotification(row: NotificationRow): MaintenanceIssueNotification {
  return { id: row.id, hotelId: row.hotel_id, recipientId: row.recipient_id, issueId: row.issue_id,
    title: row.title, message: row.message, createdAt: row.created_at, readAt: row.read_at };
}

async function photosFor(db: D1Database, hotelId: string, issueId: string): Promise<MaintenanceIssuePhoto[]> {
  const { results } = await db.prepare('SELECT id, issue_id, hotel_id, object_key, content_type, view_type FROM maintenance_issue_photos WHERE hotel_id = ? AND issue_id = ? ORDER BY id')
    .bind(hotelId, issueId).all<PhotoRow>();
  return results.map(toPhoto);
}

function toIssue(row: IssueRow, photos: MaintenanceIssuePhoto[], replacement: MaintenanceReplacement | null): MaintenanceIssue {
  return { id: row.id, hotelId: row.hotel_id, unitId: row.unit_id, roomNumber: row.room_number,
    category: row.category, description: row.description, reporterId: row.reporter_id, reporterName: row.reporter_name,
    createdAt: row.created_at, updatedAt: row.updated_at, status: row.status,
    idempotencyKey: row.idempotency_key, photos, replacement };
}

async function issueByIdempotency(db: D1Database, hotelId: string, reporterId: string, key: string): Promise<MaintenanceIssue | null> {
  const row = await db.prepare('SELECT * FROM maintenance_issues WHERE hotel_id = ? AND reporter_id = ? AND idempotency_key = ?')
    .bind(hotelId, reporterId, key).first<IssueRow>();
  return row ? toIssue(row, await photosFor(db, hotelId, row.id), await replacementFor(db, hotelId, row.id)) : null;
}

export const maintenanceIssueStoreD1: MaintenanceIssueStore = {
  async removePhoto(hotelId, issueId, photoId, updatedAt) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    await db.batch([
      db.prepare('DELETE FROM maintenance_issue_photos WHERE hotel_id = ? AND issue_id = ? AND id = ?').bind(hotelId, issueId, photoId),
      db.prepare('UPDATE maintenance_issues SET updated_at = ? WHERE hotel_id = ? AND id = ?').bind(updatedAt, hotelId, issueId),
    ]);
    return issueById(db, hotelId, issueId);
  },
  async addPhotos(hotelId, issueId, photos, updatedAt) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    const first = photos[0];
    if (!first || photos.length > 5) return null;
    // The first attachment reserves room for the whole batch within this transaction.
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO maintenance_issue_photos (id, hotel_id, issue_id, object_key, content_type, view_type)
        SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM maintenance_issues WHERE hotel_id = ? AND id = ?)
        AND (SELECT COUNT(*) FROM maintenance_issue_photos WHERE hotel_id = ? AND issue_id = ?) <= ?`)
        .bind(first.id, hotelId, issueId, first.objectKey, first.contentType, first.view ?? 'photo', hotelId, issueId, hotelId, issueId, 5 - photos.length),
      ...photos.slice(1).map((photo) => db.prepare(`INSERT OR IGNORE INTO maintenance_issue_photos (id, hotel_id, issue_id, object_key, content_type, view_type)
        SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM maintenance_issue_photos WHERE hotel_id = ? AND issue_id = ? AND id = ?)
        AND (SELECT COUNT(*) FROM maintenance_issue_photos WHERE hotel_id = ? AND issue_id = ?) < 5`)
        .bind(photo.id, hotelId, issueId, photo.objectKey, photo.contentType, photo.view ?? 'photo', hotelId, issueId, first.id, hotelId, issueId)),
      db.prepare(`UPDATE maintenance_issues SET updated_at = ? WHERE hotel_id = ? AND id = ?
        AND EXISTS (SELECT 1 FROM maintenance_issue_photos WHERE hotel_id = ? AND issue_id = ? AND id = ?)`)
        .bind(updatedAt, hotelId, issueId, hotelId, issueId, first.id),
    ]);
    const saved = await issueById(db, hotelId, issueId);
    return saved && photos.every((photo) => saved.photos.some((item) => item.id === photo.id)) ? saved : null;
  },
  async findByIdempotencyKey(hotelId, reporterId, key) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    return issueByIdempotency(db, hotelId, reporterId, key);
  },
  async create({ issue, notifications }) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO maintenance_issues
        (id, hotel_id, unit_id, room_number, category, description, reporter_id, reporter_name, created_at, updated_at, status, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(issue.id, issue.hotelId, issue.unitId, issue.roomNumber, issue.category, issue.description, issue.reporterId,
          issue.reporterName, issue.createdAt, issue.updatedAt, issue.status, issue.idempotencyKey),
      ...issue.photos.map((photo) => db.prepare(`INSERT OR IGNORE INTO maintenance_issue_photos (id, hotel_id, issue_id, object_key, content_type, view_type)
        SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM maintenance_issues WHERE id = ? AND hotel_id = ?)`)
        .bind(photo.id, photo.hotelId, photo.issueId, photo.objectKey, photo.contentType, photo.view ?? 'photo', issue.id, issue.hotelId)),
      ...notifications.map((notification) => db.prepare(`INSERT OR IGNORE INTO maintenance_issue_notifications
        (id, hotel_id, recipient_id, issue_id, title, message, created_at, read_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM maintenance_issues WHERE id = ? AND hotel_id = ?)`)
        .bind(notification.id, notification.hotelId, notification.recipientId, notification.issueId, notification.title,
          notification.message, notification.createdAt, notification.readAt, issue.id, issue.hotelId)),
    ]);
    const saved = await issueByIdempotency(db, issue.hotelId, issue.reporterId, issue.idempotencyKey);
    if (!saved) throw new Error('Maintenance issue could not be saved.');
    return { issue: saved, created: saved.id === issue.id };
  },

  async get(hotelId, issueId) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    return issueById(db, hotelId, issueId);
  },

  async list(hotelId, limit) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    const selection = 'FROM maintenance_issues WHERE hotel_id = ? ORDER BY created_at DESC, id DESC' + (limit === undefined ? '' : ' LIMIT ?');
    const bindings = limit === undefined ? [hotelId] : [hotelId, Math.max(1, Math.min(200, limit))];
    const { results } = await db.prepare(`SELECT * ${selection}`).bind(...bindings).all<IssueRow>();
    if (results.length === 0) return [];
    const { results: photoRows } = await db.prepare(`SELECT id, issue_id, hotel_id, object_key, content_type, view_type
      FROM maintenance_issue_photos WHERE hotel_id = ? AND issue_id IN (SELECT id ${selection}) ORDER BY id`)
      .bind(hotelId, ...bindings).all<PhotoRow>();
    const photosByIssue = new Map<string, MaintenanceIssuePhoto[]>();
    for (const row of photoRows) {
      const photos = photosByIssue.get(row.issue_id) ?? [];
      photos.push(toPhoto(row));
      photosByIssue.set(row.issue_id, photos);
    }
    const { results: replacements } = await db.prepare(`SELECT * FROM maintenance_issue_replacements
      WHERE hotel_id = ? AND issue_id IN (SELECT id ${selection})`).bind(hotelId, ...bindings).all<ReplacementRow>();
    const replacementsByIssue = new Map(replacements.map((row) => [row.issue_id, toReplacement(row)]));
    return results.map((row) => toIssue(row, photosByIssue.get(row.id) ?? [], replacementsByIssue.get(row.id) ?? null));
  },

  async updateStatus(hotelId, issueId, status, updatedAt) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    const result = await db.prepare(`UPDATE maintenance_issues SET status = ?, updated_at = ? WHERE hotel_id = ? AND id = ?
      AND (? <> 'Resolved' OR NOT EXISTS (SELECT 1 FROM maintenance_issue_replacements WHERE hotel_id = ? AND issue_id = ? AND status = 'Pending'))`)
      .bind(status, updatedAt, hotelId, issueId, status, hotelId, issueId).run();
    return result.meta.changes ? issueById(db, hotelId, issueId) : null;
  },

  async requestReplacement(hotelId, issueId, replacement, notifications) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    // The request and its notices commit together. The request ID guards retries and concurrent submissions.
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO maintenance_issue_replacements
        (issue_id, hotel_id, id, status, reason, requested_by_id, requested_by_name, requested_at)
        SELECT ?, ?, ?, 'Pending', ?, ?, ?, ? WHERE EXISTS
        (SELECT 1 FROM maintenance_issues WHERE hotel_id = ? AND id = ? AND status <> 'Resolved')`)
        .bind(issueId, hotelId, replacement.id, replacement.reason, replacement.requestedById, replacement.requestedByName,
          replacement.requestedAt, hotelId, issueId),
      db.prepare(`UPDATE maintenance_issues SET updated_at = ? WHERE hotel_id = ? AND id = ?
        AND EXISTS (SELECT 1 FROM maintenance_issue_replacements WHERE hotel_id = ? AND issue_id = ? AND id = ?)`)
        .bind(replacement.requestedAt, hotelId, issueId, hotelId, issueId, replacement.id),
      ...notifications.map((notification) => db.prepare(`INSERT OR IGNORE INTO maintenance_issue_notifications
        (id, hotel_id, recipient_id, issue_id, title, message, created_at, read_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS
        (SELECT 1 FROM maintenance_issue_replacements WHERE hotel_id = ? AND issue_id = ? AND id = ?)`)
        .bind(notification.id, hotelId, notification.recipientId, issueId, notification.title, notification.message,
          notification.createdAt, notification.readAt, hotelId, issueId, replacement.id)),
    ]);
    return issueById(db, hotelId, issueId);
  },

  async approveReplacement(hotelId, issueId, approverId, approverName, approvedAt) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    await db.batch([
      db.prepare(`UPDATE maintenance_issue_replacements SET status = 'Approved', approved_by_id = ?, approved_by_name = ?, approved_at = ?
        WHERE hotel_id = ? AND issue_id = ? AND status = 'Pending'`)
        .bind(approverId, approverName, approvedAt, hotelId, issueId),
      db.prepare(`UPDATE maintenance_issues SET updated_at = ? WHERE hotel_id = ? AND id = ?
        AND EXISTS (SELECT 1 FROM maintenance_issue_replacements WHERE hotel_id = ? AND issue_id = ? AND approved_at = ?)`)
        .bind(approvedAt, hotelId, issueId, hotelId, issueId, approvedAt),
    ]);
    return issueById(db, hotelId, issueId);
  },

  async listNotifications(hotelId, recipientId, limit = 30) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    const { results } = await db.prepare(`SELECT id, hotel_id, recipient_id, issue_id, title, message, created_at, read_at
      FROM maintenance_issue_notifications WHERE hotel_id = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(hotelId, recipientId, Math.max(1, Math.min(100, limit))).all<NotificationRow>();
    return results.map(toNotification);
  },

  async markNotificationsRead(hotelId, recipientId, issueId, readAt) {
    const db = getDemoDatabase();
    if (!db) throw new Error('Durable maintenance storage is unavailable.');
    await ensureSchema(db);
    await db.prepare(`UPDATE maintenance_issue_notifications SET read_at = ?
      WHERE hotel_id = ? AND recipient_id = ? AND issue_id = ? AND read_at IS NULL`)
      .bind(readAt, hotelId, recipientId, issueId).run();
  },
};
