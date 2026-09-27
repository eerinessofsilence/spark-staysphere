import { beforeEach, describe, expect, it } from 'vitest';
import type { Booking, Hotel } from '../domain/schemas';
import type { HotelRepository } from '../domain/ports';
import { mockMessagingStore, resetMockMessagingStore } from '../infrastructure/messaging-store-mock';
import { CommunicationsService, MESSAGE_MAX } from './communications-service';

const hotel = { id: 'hotel_1', slug: 'asteria-cove' } as Hotel;

function booking(reference: string, email: string, checkIn: string): Booking {
  return {
    reference,
    hotelId: hotel.id,
    status: 'confirmed',
    checkIn,
    guest: { firstName: 'Ada', lastName: reference, email, phone: '+357 99 000 000' },
  } as Booking;
}

const bookings = [booking('AAA111', 'ada@example.com', '2026-10-01'), booking('BBB222', 'bob@example.com', '2026-10-05')];

const repository = {
  async getHotel(slug: string) {
    return slug === hotel.slug ? hotel : null;
  },
  async listBookings() {
    return bookings;
  },
  async getBookingByReference(reference: string) {
    return bookings.find((b) => b.reference === reference) ?? null;
  },
} as unknown as HotelRepository;

const clock = { now: () => new Date('2026-09-25T12:00:00.000Z') };
const sent: unknown[] = [];
const outbound = { async send(input: unknown) { sent.push(input); } };

describe('CommunicationsService', () => {
  let service: CommunicationsService;
  beforeEach(() => {
    resetMockMessagingStore();
    sent.length = 0;
    service = new CommunicationsService(mockMessagingStore, repository, clock, outbound);
  });

  it('seeds demo threads from the hotel’s own bookings once, newest first', async () => {
    const first = await service.listConversations(hotel.slug);
    const again = await service.listConversations(hotel.slug);
    expect(first.length).toBeGreaterThan(0);
    expect(again.map((c) => c.id)).toEqual(first.map((c) => c.id));
    expect(first.every((c) => bookings.some((b) => b.reference === c.bookingReference))).toBe(true);
    for (let i = 1; i < first.length; i += 1) expect(first[i - 1].lastMessageAt >= first[i].lastMessageAt).toBe(true);
    // A thread whose last line is the guest's waits unread; one the desk answered does not.
    expect(first.some((c) => c.unread === 1)).toBe(true);
    expect(first.some((c) => c.unread === 0)).toBe(true);
  });

  it('opening a thread clears its unread count and lists messages oldest first', async () => {
    const [unread] = (await service.listConversations(hotel.slug)).filter((c) => c.unread > 0);
    const thread = await service.openThread(hotel.slug, unread.id);
    expect(thread?.conversation.unread).toBe(0);
    expect(thread?.messages.length).toBeGreaterThan(0);
    const sent = thread!.messages.map((m) => m.sentAt);
    expect([...sent].sort()).toEqual(sent);
    expect((await service.listConversations(hotel.slug)).find((c) => c.id === unread.id)?.unread).toBe(0);
  });

  it('a reply is trimmed, bounded, stamped by the clock and becomes the thread’s last line', async () => {
    const [c] = await service.listConversations(hotel.slug);
    expect(await service.send(hotel.slug, c.id, '   ', 'Elena')).toEqual({ ok: false, error: 'empty' });
    expect(await service.send(hotel.slug, c.id, 'x'.repeat(MESSAGE_MAX + 1), 'Elena')).toEqual({ ok: false, error: 'tooLong' });
    expect(await service.send(hotel.slug, 'nope', 'hi', 'Elena')).toEqual({ ok: false, error: 'notFound' });
    const result = await service.send(hotel.slug, c.id, '  Your room is ready.  ', 'Elena');
    expect(result.ok && result.message).toMatchObject({ from: 'hotel', author: 'Elena', body: 'Your room is ready.', sentAt: '2026-09-25T12:00:00.000Z' });
    const top = (await service.listConversations(hotel.slug))[0];
    expect(top.id).toBe(c.id);
    expect(top.lastMessage).toBe('Your room is ready.');
  });

  it('starts one thread per booking and reuses it', async () => {
    const started = await service.start(hotel.slug, 'BBB222', 'email');
    expect(started.ok && started.conversation).toMatchObject({ bookingReference: 'BBB222', channel: 'email', guestEmail: 'bob@example.com', unread: 0 });
    const again = await service.start(hotel.slug, 'BBB222', 'sms');
    expect(again.ok && again.conversation.id).toBe(started.ok && started.conversation.id);
    expect(await service.start(hotel.slug, 'ZZZ999', 'chat')).toEqual({ ok: false, error: 'bookingNotFound' });
  });

  it('a desk reply on email goes out through the carrier; a site-chat reply does not', async () => {
    const started = await service.start(hotel.slug, 'BBB222', 'email');
    const id = started.ok ? started.conversation.id : '';
    await service.send(hotel.slug, id, 'See you soon.', 'Elena');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: 'email', to: { email: 'bob@example.com' }, body: 'See you soon.' });
    const chat = await service.receive(hotel.slug, { channel: 'chat', name: 'Ada', email: 'ada@example.com', bookingReference: 'AAA111', body: 'Hi' });
    await service.send(hotel.slug, chat.ok ? chat.conversation.id : '', 'Hello!', 'Elena');
    expect(sent).toHaveLength(1);
  });

  it('a guest writing in lands in one thread per channel and stay, unread for the desk', async () => {
    const first = await service.receive(hotel.slug, { channel: 'chat', name: 'Ada', email: 'ADA@example.com', bookingReference: 'AAA111', body: 'Is late check-in ok?' });
    const second = await service.receive(hotel.slug, { channel: 'chat', name: 'Ada', email: 'ada@example.com', bookingReference: 'AAA111', body: 'Around midnight.' });
    expect(first.ok && second.ok && first.conversation.id === second.conversation.id).toBe(true);
    const listed = (await service.listConversations(hotel.slug)).find((c) => c.id === (first.ok ? first.conversation.id : ''));
    expect(listed).toMatchObject({ unread: 2, channel: 'chat', bookingReference: 'AAA111', guestName: 'Ada', lastMessage: 'Around midnight.' });
    // A reference that is not the sender's own is refused, not attached.
    expect(await service.receive(hotel.slug, { channel: 'chat', name: 'Mallory', email: 'mallory@example.com', bookingReference: 'AAA111', body: 'hi' })).toEqual({ ok: false, error: 'bookingMismatch' });
    // The guest reads their thread only under their own email, and reading does not clear the desk's count.
    expect(await service.guestThread(hotel.slug, listed!.id, 'ada@example.com')).toMatchObject({ messages: [{ body: 'Is late check-in ok?' }, { body: 'Around midnight.' }] });
    expect(await service.guestThread(hotel.slug, listed!.id, 'bob@example.com')).toBeNull();
    expect((await service.listConversations(hotel.slug)).find((c) => c.id === listed!.id)?.unread).toBe(2);
    expect(await service.guestChatFor(hotel.slug, 'AAA111', 'ada@example.com')).toMatchObject({ conversation: { id: listed!.id } });
  });
});
