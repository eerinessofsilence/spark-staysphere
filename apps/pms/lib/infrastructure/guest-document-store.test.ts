import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLibsqlD1 } from './libsql-d1';
import { ensureSchema } from './d1-schema';
import { emptyIdentity, type GuestDocument } from '@/lib/domain/guest-document';
import { createGuestProfile, listGuestProfiles, saveGuestIdentity, setBookingStayState } from './d1-hotel-repository';

const context = vi.hoisted(() => ({ db: null as D1Database | null }));
vi.mock('./cloudflare-env', () => ({ getDemoDatabase: () => context.db }));
import { guestDocumentStore } from './guest-document-store';

const identity = { ...emptyIdentity, firstName: 'Test', lastName: 'Guest', issuingCountry: 'UTO', documentNumber: 'TEST123' };
const document: GuestDocument = { id: 'doc-1', hotelId: 'hotel-1', guestId: 'test@example.com', reservationId: 'booking-1', reservationReference: 'ABC123', identity, objectKeys: ['documents/hotel-1/doc-1/original'], contentType: 'image/jpeg', status: 'active', createdAt: '2026-09-27T00:00:00.000Z', deletedAt: null, deletionReason: null };
beforeEach(async () => { context.db = createLibsqlD1('file::memory:'); await ensureSchema(context.db); });

describe('D1 document persistence', () => {
  it('scopes metadata by hotel and does not resurrect images with stale writes', async () => {
    await guestDocumentStore.save(document);
    expect(await guestDocumentStore.get('hotel-2', document.id)).toBeNull();
    expect(await guestDocumentStore.list('hotel-2')).toEqual([]);
    await guestDocumentStore.save({ ...document, status: 'pending_deletion', deletionReason: 'reservation_checkout' });
    await guestDocumentStore.save(document);
    expect((await guestDocumentStore.get('hotel-1', document.id))?.status).toBe('pending_deletion');
  });
  it('extends the existing guest profile and prevents cross-property identity updates', async () => {
    const db = context.db!;
    await createGuestProfile(db, { id: 'profile-1', hotelId: 'hotel-1', firstName: 'Old', lastName: 'Name', email: 'test@example.com', phone: '123456789', createdAt: '2026-09-27T00:00:00.000Z' });
    await saveGuestIdentity(db, 'profile-1', 'hotel-2', identity);
    expect((await listGuestProfiles(db, 'hotel-1'))[0].identity).toBeUndefined();
    await saveGuestIdentity(db, 'profile-1', 'hotel-1', identity);
    expect((await listGuestProfiles(db, 'hotel-1'))[0]).toMatchObject({ firstName: 'Test', lastName: 'Guest', identity });
  });
  it('persists checkout and deletion intent together; undo does not undo deletion', async () => {
    const db = context.db!;
    await db.prepare(`INSERT INTO bookings (id, reference, idempotency_key, hotel_id, room_type_id, rate_plan_id, check_in, check_out, adults, children, guest_first_name, guest_last_name, guest_email, guest_phone, add_on_ids, total, currency, status, created_at) VALUES ('booking-1', 'ABC123', 'test-key', 'hotel-1', 'room', 'rate', '2026-09-27', '2026-09-30', 1, 0, 'Test', 'Guest', 'test@example.com', '123456789', '[]', 100, 'EUR', 'confirmed', '2026-09-27T00:00:00.000Z')`).run();
    await guestDocumentStore.save(document);
    await setBookingStayState(db, 'ABC123', 'checked_out');
    expect((await guestDocumentStore.get('hotel-1', document.id))).toMatchObject({ status: 'pending_deletion', deletionReason: 'reservation_checkout' });
    await setBookingStayState(db, 'ABC123', 'checked_in');
    expect((await guestDocumentStore.get('hotel-1', document.id))?.status).toBe('pending_deletion');
  });
});
