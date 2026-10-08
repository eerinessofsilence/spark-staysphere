import type { DraftHotel } from '../domain/tenant';
import { ensureSchema } from './d1-schema';

const accountQuery = `SELECT a.member_id AS id, a.name, a.email, m.role, a.password_hash AS passwordHash, a.onboarded
  FROM admin_accounts a JOIN team_members m ON m.id = a.member_id WHERE lower(a.email) = lower(?)`;

export async function createAccount(db: D1Database, input: { id: string; name: string; email: string; passwordHash: string; createdAt: string }): Promise<boolean> {
  await ensureSchema(db);
  const result = await db.batch([
    db.prepare('INSERT INTO team_members (id, name, email, role) VALUES (?, ?, ?, \'Owner\') ON CONFLICT(email) DO NOTHING').bind(input.id, input.name, input.email),
    db.prepare(`INSERT INTO admin_accounts (member_id, name, email, password_hash, created_at)
      SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM team_members WHERE id = ? AND lower(email) = lower(?))
      ON CONFLICT(email) DO NOTHING`).bind(input.id, input.name, input.email, input.passwordHash, input.createdAt, input.id, input.email),
  ]);
  return result[0]!.meta.changes === 1 && result[1]!.meta.changes === 1;
}

export async function findAccount(db: D1Database, email: string) {
  await ensureSchema(db);
  return db.prepare(accountQuery).bind(email.trim()).first<{ id: string; name: string; email: string; role: string; passwordHash: string; onboarded: number }>();
}

export async function markOnboarded(db: D1Database, memberId: string): Promise<void> {
  await ensureSchema(db);
  await db.prepare('UPDATE admin_accounts SET onboarded = 1 WHERE member_id = ?').bind(memberId).run();
}

export async function createHotel(db: D1Database, input: DraftHotel & { submissionKey: string }): Promise<DraftHotel> {
  await ensureSchema(db);
  await db.batch([
    db.prepare(`INSERT INTO draft_hotels (id, slug, name, location, currency, timezone, owner_id, submission_key, created_at, trial_ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, submission_key) DO NOTHING`)
      .bind(input.id, input.slug, input.name, input.location, input.currency, input.timezone, input.ownerId, input.submissionKey, input.createdAt, input.trialEndsAt),
    db.prepare('INSERT OR IGNORE INTO team_member_hotel_scopes (member_id) VALUES (?)').bind(input.ownerId),
    db.prepare(`INSERT OR IGNORE INTO team_member_hotels (member_id, hotel_id)
      SELECT ?, id FROM draft_hotels WHERE owner_id = ? AND submission_key = ?`).bind(input.ownerId, input.ownerId, input.submissionKey),
  ]);
  const hotel = await db.prepare(`SELECT id, slug, name, location, currency, timezone, owner_id AS ownerId, created_at AS createdAt, trial_ends_at AS trialEndsAt
    FROM draft_hotels WHERE owner_id = ? AND submission_key = ?`).bind(input.ownerId, input.submissionKey).first<DraftHotel>();
  if (!hotel) throw new Error('Hotel creation was not persisted.');
  return hotel;
}

const hotelSelect = 'SELECT id, slug, name, location, currency, timezone, owner_id AS ownerId, created_at AS createdAt, trial_ends_at AS trialEndsAt FROM draft_hotels';

export async function listHotelsForMember(db: D1Database, memberId: string): Promise<DraftHotel[]> {
  await ensureSchema(db);
  const result = await db.prepare(`${hotelSelect} h JOIN team_member_hotels m ON m.hotel_id = h.id WHERE m.member_id = ? ORDER BY h.created_at DESC`).bind(memberId).all<DraftHotel>();
  return result.results;
}

export async function findHotel(db: D1Database, id: string): Promise<DraftHotel | null> {
  await ensureSchema(db);
  return db.prepare(`${hotelSelect} WHERE id = ?`).bind(id).first<DraftHotel>();
}
