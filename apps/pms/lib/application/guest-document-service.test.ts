import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingEngineAdapter, HotelRepository, PaymentProvider } from '@/lib/domain/ports';
import { emptyIdentity, type GuestDocument, type GuestDocumentStore, type PrivateDocumentStorage } from '@/lib/domain/guest-document';
import { bookingSchema, type GuestProfile } from '@/lib/domain/schemas';
import { GuestDocumentService } from './guest-document-service';
import { BookingService } from './booking-service';

const identity = { ...emptyIdentity, firstName: 'Test', lastName: 'Guest', documentNumber: 'TEST123', issuingCountry: 'UTO' };
const guest = { firstName: 'Test', lastName: 'Guest', email: 'guest@example.com', phone: '+1234567890' };
const original = bookingSchema.parse({ id: 'booking-1', reference: 'ABC123', idempotencyKey: 'key', hotelId: 'hotel-1', roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2020-01-01', checkOut: '2020-01-02', adults: 1, children: 0, guest, addOnIds: [], total: 100, currency: 'EUR', status: 'confirmed', stayState: 'checked_in', createdAt: '2020-01-01T00:00:00.000Z' });
let booking = structuredClone(original);
let records: Map<string, GuestDocument>;
let profiles: GuestProfile[];
let files: Map<string, ArrayBuffer>;
let store: GuestDocumentStore;
let storage: PrivateDocumentStorage;
let repository: HotelRepository;
let service: GuestDocumentService;
const bytes = new Uint8Array([255, 216, 255, 0]).buffer;

beforeEach(() => {
  booking = structuredClone(original); records = new Map(); profiles = []; files = new Map();
  store = {
    async get(hotel, id) { return structuredClone(records.get(`${hotel}:${id}`) ?? null); },
    async list(hotel) { return structuredClone([...records.values()].filter((r) => !hotel || r.hotelId === hotel)); },
    async save(document) { records.set(`${document.hotelId}:${document.id}`, structuredClone(document)); },
  };
  storage = { async put(key, data) { files.set(key, data); }, async get(key) { const body = files.get(key); return body ? { body, contentType: 'image/jpeg' } : null; }, async delete(keys) { keys.forEach((key) => files.delete(key)); } };
  repository = {
    async getBookingByReference(ref) { return ref === booking.reference ? structuredClone(booking) : null; },
    async listBookings() { return [structuredClone(booking)]; },
    async listGuestProfiles(hotel) { return profiles.filter((p) => p.hotelId === hotel); },
    async createGuestProfile(profile) { profiles.push(profile); return profile; },
    async saveGuestIdentity(id, hotel, value) { profiles = profiles.map((p) => p.id === id && p.hotelId === hotel ? { ...p, identity: value } : p); },
    async setBookingStayState(_ref, state) { booking = { ...booking, stayState: state }; return booking; },
  } as HotelRepository;
  service = new GuestDocumentService(repository, store, storage);
});

describe('guest documents lifecycle', () => {
  it('replaces a private photo and rejects invalid images, other properties and ended stays', async () => {
    await service.attach(booking, identity, bytes);
    await expect(service.replacePhoto('hotel-2', booking.id, identity, bytes)).rejects.toThrow();
    await expect(service.replacePhoto('hotel-1', booking.id, identity, new Uint8Array([0]).buffer)).rejects.toThrow();
    await service.replacePhoto('hotel-1', booking.id, { ...identity, documentNumber: 'REPLACED' }, bytes);
    expect((await store.get('hotel-1', booking.id))?.identity.documentNumber).toBe('REPLACED');
    expect(await service.readImage('hotel-1', booking.id)).not.toBeNull();
    booking.stayState = 'checked_out';
    await expect(service.replacePhoto('hotel-1', booking.id, identity, bytes)).rejects.toThrow();
    await service.retryDeletions();
    expect(files.size).toBe(0);
  });
  it('edits document details only in its property and manually deletes the photo with history retained', async () => {
    await service.attach(booking, identity, bytes);
    await expect(service.updateIdentity('hotel-2', booking.id, identity)).rejects.toThrow();
    await service.updateIdentity('hotel-1', booking.id, { ...identity, documentNumber: 'NEW123' });
    expect((await store.get('hotel-1', booking.id))?.identity.documentNumber).toBe('NEW123');
    await expect(service.removePhoto('hotel-2', booking.id)).rejects.toThrow();
    await service.removePhoto('hotel-1', booking.id);
    expect(files.size).toBe(0);
    expect(await store.get('hotel-1', booking.id)).toMatchObject({ status: 'deleted', deletionReason: 'manual', identity: { documentNumber: 'NEW123' } });
  });
  it('keeps an image beyond planned checkout; links the same guest and reservation; denies other properties', async () => {
    await service.attach(booking, identity, bytes);
    await service.retryDeletions();
    expect(await service.readImage('hotel-1', booking.id)).not.toBeNull();
    expect(await service.readImage('hotel-2', booking.id)).toBeNull();
    expect(await service.listForGuest('hotel-2', guest.email)).toEqual([]);
    expect((await service.listForGuest('hotel-1', guest.email))[0]).toMatchObject({ reservationId: booking.id, reservationReference: booking.reference, guestId: guest.email, status: 'active' });
  });
  it('actual checkout removes originals and derivatives, preserves history and becomes idempotent', async () => {
    await service.attach(booking, identity, bytes);
    const record = (await store.get('hotel-1', booking.id))!;
    record.objectKeys.push('documents/hotel-1/booking-1/thumbnail');
    files.set(record.objectKeys[1], bytes); await store.save(record);
    const bookings = new BookingService(repository, {} as BookingEngineAdapter, {} as PaymentProvider, undefined, undefined, undefined, (value) => service.afterCheckout(value));
    expect((await bookings.setStayStateAsHotel('ABC123', 'checked_out')).outcome).toBe('updated');
    expect(files.size).toBe(0);
    expect(await service.readImage('hotel-1', booking.id)).toBeNull();
    const removed = (await service.listForGuest('hotel-1', guest.email))[0];
    expect(removed).toMatchObject({ status: 'deleted', deletionReason: 'reservation_checkout' });
    expect(removed.deletedAt).toBeTruthy();
    await service.retryDeletions();
    expect((await store.get('hotel-1', booking.id))?.deletedAt).toBe(removed.deletedAt);
    expect((await repository.listBookings())[0]).toMatchObject({ id: booking.id, stayState: 'checked_out' });
  });
  it('storage errors do not block checkout; restart retries the durable pending work', async () => {
    await service.attach(booking, identity, bytes);
    const remove = storage.delete;
    storage.delete = vi.fn().mockRejectedValue(new Error('transient'));
    const bookings = new BookingService(repository, {} as BookingEngineAdapter, {} as PaymentProvider, undefined, undefined, undefined, (value) => service.afterCheckout(value));
    expect((await bookings.setStayStateAsHotel('ABC123', 'checked_out')).outcome).toBe('updated');
    expect((await store.get('hotel-1', booking.id))?.status).toBe('pending_deletion');
    expect(await service.readImage('hotel-1', booking.id)).toBeNull();
    storage.delete = remove;
    await new GuestDocumentService(repository, store, storage).retryDeletions();
    expect(files.size).toBe(0);
    expect((await store.get('hotel-1', booking.id))?.status).toBe('deleted');
  });
  it('recovers from a process crash after checkout but before the deletion hook', async () => {
    await service.attach(booking, identity, bytes);
    booking.stayState = 'checked_out';
    expect(await service.readImage('hotel-1', booking.id)).toBeNull();
    await service.retryDeletions();
    expect(files.size).toBe(0);
  });
  it('handles checkout during upload and never reactivates a retired image', async () => {
    storage.put = async (key, data) => { booking.stayState = 'checked_out'; await service.afterCheckout(booking); files.set(key, data); };
    await service.attach(booking, identity, bytes);
    expect(files.size).toBe(0);
    expect((await store.get('hotel-1', booking.id))?.status).toBe('deleted');
    await expect(service.attach(booking, identity, bytes)).rejects.toThrow();
  });
  it('asks before selecting an existing email or matching document, with property-scoped guest records', async () => {
    expect((await service.reviewGuest('hotel-1', guest, identity)).kind).toBe('matches');
    expect(profiles).toHaveLength(0);
    expect((await service.reviewGuest('hotel-1', guest, identity, guest.email)).kind).toBe('confirmed');
    expect(profiles[0].identity).toEqual(identity);
    expect((await service.reviewGuest('hotel-1', { ...guest, email: 'other@example.com' }, identity)).kind).toBe('matches');
    expect((await service.reviewGuest('hotel-2', guest, identity)).kind).toBe('confirmed');
    expect(profiles).toHaveLength(2);
    await expect(service.reviewGuest('hotel-2', guest, identity, 'foreign@example.com')).rejects.toThrow();
  });
  it('rejects disguised images and never uploads twice on a successful retry', async () => {
    await expect(service.attach(booking, identity, new TextEncoder().encode('<svg/>').buffer)).rejects.toThrow();
    const put = vi.spyOn(storage, 'put');
    await service.attach(booking, identity, bytes); await service.attach(booking, identity, bytes);
    expect(put).toHaveBeenCalledTimes(1);
  });
  it('offers a document match before asking for missing contact details', async () => {
    await service.reviewGuest('hotel-1', guest, identity, guest.email);
    const noContact = { ...guest, email: '', phone: '' };
    expect((await service.reviewGuest('hotel-1', noContact, identity)).kind).toBe('matches');
    expect(await service.reviewGuest('hotel-1', noContact, identity, guest.email)).toMatchObject({ kind: 'confirmed', guest });
  });
  it('does not abandon pending erasure when checkout is undone', async () => {
    await service.attach(booking, identity, bytes);
    const remove = storage.delete;
    storage.delete = vi.fn().mockRejectedValue(new Error('temporary'));
    booking.stayState = 'checked_out'; await service.afterCheckout(booking);
    booking.stayState = 'checked_in'; storage.delete = remove;
    await service.retryDeletions();
    expect(files.size).toBe(0);
    expect(await service.readImage('hotel-1', booking.id)).toBeNull();
  });
  it('reapplies a tombstone if an interrupted PUT finishes after erasure', async () => {
    await service.attach(booking, identity, bytes);
    const key = (await store.get('hotel-1', booking.id))!.objectKeys[0];
    booking.stayState = 'checked_out'; await service.afterCheckout(booking);
    const deletedAt = (await store.get('hotel-1', booking.id))!.deletedAt;
    files.set(key, bytes);
    await service.retryDeletions();
    expect(files.size).toBe(0);
    expect((await store.get('hotel-1', booking.id))!.deletedAt).toBe(deletedAt);
  });
});
