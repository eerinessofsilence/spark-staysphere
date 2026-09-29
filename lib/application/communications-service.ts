import { matchesGuestEmail } from '../domain/booking';
import type { ChatMessage, Clock, Conversation, ConversationChannel, HotelRepository, MessagingStore, OutboundMessenger } from '../domain/ports';
import type { Booking } from '../domain/schemas';

export const MESSAGE_MAX = 2000;

export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: 'notFound' | 'empty' | 'tooLong' };

export type StartResult = { ok: true; conversation: Conversation } | { ok: false; error: 'bookingNotFound' };

/** What a guest sends in from outside: the site's chat form, or a mail the inbound webhook relays. */
export interface InboundMessage {
  channel: ConversationChannel;
  name: string;
  email: string;
  phone?: string | null;
  /** When the guest gave one (the chat on a confirmation page always does), the thread is that stay's. */
  bookingReference?: string | null;
  body: string;
}

export type ReceiveResult =
  | { ok: true; conversation: Conversation; message: ChatMessage }
  | { ok: false; error: 'empty' | 'tooLong' | 'hotelNotFound' | 'bookingMismatch' };

/**
 * A demo inbox needs something in it: the first time a hotel's inbox is
 * opened, a handful of threads are written from that hotel's own bookings
 * (real guests, real references), so the desk sees what the screen is
 * for. Idempotent — keyed by hotel and slot, written once, then ordinary
 * rows like any the desk starts itself.
 */
const DEMO_THREADS: {
  slot: string;
  channel: ConversationChannel;
  minutesAgo: number;
  lines: { from: ChatMessage['from']; body: string; minutesBefore: number }[];
}[] = [
  {
    slot: 'arrival-time',
    channel: 'whatsapp',
    minutesAgo: 25,
    lines: [
      { from: 'guest', body: 'Hi! Our flight lands at 22:40 — is a late check-in around midnight ok?', minutesBefore: 70 },
      { from: 'hotel', body: 'Of course. Reception is open all night; your key will be ready. Do you need a transfer from the airport?', minutesBefore: 55 },
      { from: 'guest', body: 'Yes please, two of us with two suitcases.', minutesBefore: 0 },
    ],
  },
  {
    slot: 'breakfast',
    channel: 'chat',
    minutesAgo: 180,
    lines: [
      { from: 'guest', body: 'Is breakfast included in our rate, and until what time is it served?', minutesBefore: 30 },
      { from: 'hotel', body: 'It is — breakfast runs 7:00 to 10:30 on the terrace, and until 11:00 at weekends.', minutesBefore: 0 },
    ],
  },
  {
    slot: 'invoice',
    channel: 'email',
    minutesAgo: 26 * 60,
    lines: [
      { from: 'guest', body: 'Could you send the invoice for our stay to my company address? Details below.', minutesBefore: 90 },
      { from: 'hotel', body: 'Done — the invoice with your company details is attached to the confirmation email.', minutesBefore: 0 },
    ],
  },
  {
    slot: 'crib',
    channel: 'sms',
    minutesAgo: 2 * 24 * 60,
    lines: [{ from: 'guest', body: 'We are travelling with a baby — can a crib be put in the room?', minutesBefore: 0 }],
  },
  {
    slot: 'spa',
    channel: 'chat',
    minutesAgo: 3 * 24 * 60 + 40,
    lines: [
      { from: 'guest', body: 'Can we book the spa ritual for two on the second evening?', minutesBefore: 45 },
      { from: 'hotel', body: 'Booked for 18:30 on your second evening — it is on your stay, payable at check-out.', minutesBefore: 20 },
      { from: 'guest', body: 'Perfect, thank you!', minutesBefore: 0 },
    ],
  },
];

function minusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

function guestName(booking: Booking): string {
  return `${booking.guest.firstName} ${booking.guest.lastName}`.trim();
}

/**
 * `/admin/communications`: every guest thread of the selected hotel and
 * the desk's replies into them. Rules live here, not in the page: a reply
 * is trimmed and bounded, opening a thread is what marks it read, and a
 * new thread is always tied to a booking so the desk knows who it is
 * talking to.
 */
export class CommunicationsService {
  constructor(
    private readonly store: MessagingStore,
    private readonly repository: HotelRepository,
    private readonly clock: Clock,
    private readonly outbound: OutboundMessenger,
  ) {}

  async listConversations(hotelSlug: string): Promise<Conversation[]> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return [];
    const existing = await this.store.listConversations(hotel.id);
    if (existing.length > 0) return existing;
    await this.seedDemo(hotel.id);
    return this.store.listConversations(hotel.id);
  }

  /** The thread and its messages; opening it is what clears the unread count. */
  async openThread(hotelSlug: string, id: string): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return null;
    const conversation = await this.store.getConversation(hotel.id, id);
    if (!conversation) return null;
    if (conversation.unread > 0) await this.store.markRead(id);
    const messages = await this.store.listMessages(id);
    return { conversation: { ...conversation, unread: 0 }, messages };
  }

  /** Drops the thread and its messages for the desk. The booking it was tied to is untouched. */
  async remove(hotelSlug: string, id: string): Promise<boolean> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return false;
    return this.store.deleteConversation(hotel.id, id);
  }

  async send(hotelSlug: string, conversationId: string, rawBody: string, author: string, subject?: string): Promise<SendResult> {
    const body = rawBody.trim();
    if (!body) return { ok: false, error: 'empty' };
    if (body.length > MESSAGE_MAX) return { ok: false, error: 'tooLong' };
    const hotel = await this.repository.getHotel(hotelSlug);
    const conversation = hotel ? await this.store.getConversation(hotel.id, conversationId) : null;
    if (!conversation) return { ok: false, error: 'notFound' };
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      from: 'hotel',
      author,
      body,
      sentAt: this.clock.now().toISOString(),
    };
    await this.store.saveMessage(message);
    // The site's chat is read on the site; anything else has to be carried
    // out by a provider. A carrier failure is logged, not surfaced: the reply
    // is in the thread either way, and the desk can send it again by hand.
    if (conversation.channel !== 'chat') {
      try {
        await this.outbound.send({
          channel: conversation.channel,
          to: { email: conversation.guestEmail, phone: conversation.guestPhone },
          guestName: conversation.guestName,
          hotelName: hotel!.name,
          body,
          conversationId,
          subject,
        });
      } catch (error) {
        console.error('Communications: outbound delivery failed.', error);
      }
    }
    return { ok: true, message };
  }

  /**
   * A booking-lifecycle email an automation sends on its own — see
   * `email-automations-service.ts`. Its own thread, filed under the `email`
   * channel specifically rather than `start()`'s "any channel this booking
   * already has": a guest's open site-chat thread for the same stay must
   * never swallow the send the way `send()`'s chat-channel skip would.
   */
  async sendSystemEmail(hotelSlug: string, bookingReference: string, subject: string, body: string, author: string, html?: string): Promise<void> {
    const hotel = await this.repository.getHotel(hotelSlug);
    const booking = hotel ? await this.repository.getBookingByReference(bookingReference) : null;
    if (!hotel || !booking || booking.hotelId !== hotel.id) return;
    const existing = (await this.store.listConversations(hotel.id)).find(
      (c) => c.channel === 'email' && c.bookingReference === booking.reference,
    );
    const now = this.clock.now().toISOString();
    const conversation: Conversation = existing ?? {
      id: crypto.randomUUID(),
      hotelId: hotel.id,
      channel: 'email',
      guestName: guestName(booking),
      guestEmail: booking.guest.email,
      guestPhone: booking.guest.phone,
      bookingReference: booking.reference,
      lastMessage: '',
      lastMessageAt: now,
      unread: 0,
      createdAt: now,
    };
    if (!existing) await this.store.saveConversation(conversation);
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      from: 'hotel',
      author,
      body,
      sentAt: now,
    };
    await this.store.saveMessage(message);
    try {
      await this.outbound.send({
        channel: 'email',
        to: { email: conversation.guestEmail, phone: conversation.guestPhone },
        guestName: conversation.guestName,
        hotelName: hotel.name,
        body,
        conversationId: conversation.id,
        subject,
        html,
      });
    } catch (error) {
      console.error('Communications: automated email delivery failed.', error);
    }
  }

  /**
   * A guest writing in — from the chat on their confirmation page, or a mail
   * relayed by the inbound webhook. One thread per guest, channel and stay:
   * the same address on the same channel lands in the thread it already
   * has, so a guest who writes twice is one conversation, not two. A
   * reference is checked against the booking's own email before it is
   * trusted, so a guessed reference cannot attach a stranger's stay.
   */
  async receive(hotelSlug: string, input: InboundMessage): Promise<ReceiveResult> {
    const body = input.body.trim();
    if (!body) return { ok: false, error: 'empty' };
    if (body.length > MESSAGE_MAX) return { ok: false, error: 'tooLong' };
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return { ok: false, error: 'hotelNotFound' };
    const email = input.email.trim().toLowerCase();

    let reference: string | null = null;
    if (input.bookingReference) {
      const booking = await this.repository.getBookingByReference(input.bookingReference.trim().toUpperCase());
      if (!booking || booking.hotelId !== hotel.id || !matchesGuestEmail(booking.guest.email, email)) {
        return { ok: false, error: 'bookingMismatch' };
      }
      reference = booking.reference;
    }

    const existing = (await this.store.listConversations(hotel.id)).find(
      (c) => c.channel === input.channel && matchesGuestEmail(c.guestEmail, email) && (reference === null || c.bookingReference === null || c.bookingReference === reference),
    );
    const now = this.clock.now().toISOString();
    const conversation: Conversation = existing ?? {
      id: crypto.randomUUID(),
      hotelId: hotel.id,
      channel: input.channel,
      guestName: input.name.trim() || email,
      guestEmail: email,
      guestPhone: input.phone?.trim() || null,
      bookingReference: reference,
      lastMessage: '',
      lastMessageAt: now,
      unread: 0,
      createdAt: now,
    };
    if (!existing) await this.store.saveConversation(conversation);
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      from: 'guest',
      author: conversation.guestName,
      body,
      sentAt: now,
    };
    await this.store.saveMessage(message);
    return { ok: true, conversation: { ...conversation, lastMessage: body, lastMessageAt: now, unread: conversation.unread + 1 }, message };
  }

  /** The guest's own view of a thread: only with the email the thread was opened under, and it never marks anything read. */
  async guestThread(hotelSlug: string, conversationId: string, email: string): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
    const hotel = await this.repository.getHotel(hotelSlug);
    const conversation = hotel ? await this.store.getConversation(hotel.id, conversationId) : null;
    if (!conversation || !matchesGuestEmail(conversation.guestEmail, email)) return null;
    return { conversation, messages: await this.store.listMessages(conversationId) };
  }

  /** The chat thread a stay already has, so a confirmation page reopens it rather than starting blank. */
  async guestChatFor(hotelSlug: string, bookingReference: string, email: string): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return null;
    const conversation = (await this.store.listConversations(hotel.id)).find(
      (c) => c.channel === 'chat' && c.bookingReference === bookingReference && matchesGuestEmail(c.guestEmail, email),
    );
    return conversation ? { conversation, messages: await this.store.listMessages(conversation.id) } : null;
  }

  /** A thread the desk opens itself, to a guest with a booking — one per booking, reused when it already exists. */
  async start(hotelSlug: string, bookingReference: string, channel: ConversationChannel): Promise<StartResult> {
    const hotel = await this.repository.getHotel(hotelSlug);
    const booking = hotel ? await this.repository.getBookingByReference(bookingReference) : null;
    if (!hotel || !booking || booking.hotelId !== hotel.id) return { ok: false, error: 'bookingNotFound' };
    const existing = (await this.store.listConversations(hotel.id)).find((c) => c.bookingReference === booking.reference);
    if (existing) return { ok: true, conversation: existing };
    const now = this.clock.now().toISOString();
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      hotelId: hotel.id,
      channel,
      guestName: guestName(booking),
      guestEmail: booking.guest.email,
      guestPhone: booking.guest.phone,
      bookingReference: booking.reference,
      lastMessage: '',
      lastMessageAt: now,
      unread: 0,
      createdAt: now,
    };
    await this.store.saveConversation(conversation);
    return { ok: true, conversation };
  }

  private async seedDemo(hotelId: string): Promise<void> {
    const bookings = (await this.repository.listBookings())
      .filter((booking) => booking.hotelId === hotelId && booking.status === 'confirmed')
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    if (bookings.length === 0) return;
    // One guest per thread, spread across the bookings that exist.
    const seen = new Set<string>();
    const distinct = bookings.filter((booking) => {
      if (seen.has(booking.guest.email)) return false;
      seen.add(booking.guest.email);
      return true;
    });
    const now = this.clock.now().toISOString();
    for (const [index, thread] of DEMO_THREADS.entries()) {
      const booking = distinct[index % distinct.length];
      const lastAt = minusMinutes(now, thread.minutesAgo);
      const last = thread.lines[thread.lines.length - 1];
      const conversation: Conversation = {
        id: `demo-${hotelId}-${thread.slot}`,
        hotelId,
        channel: thread.channel,
        guestName: guestName(booking),
        guestEmail: booking.guest.email,
        guestPhone: booking.guest.phone,
        bookingReference: booking.reference,
        lastMessage: last.body,
        lastMessageAt: lastAt,
        unread: last.from === 'guest' ? 1 : 0,
        createdAt: minusMinutes(lastAt, thread.lines[0].minutesBefore),
      };
      await this.store.saveConversation(conversation);
      for (const [lineIndex, line] of thread.lines.entries()) {
        // Written straight, not through `saveMessage`: the thread row above already carries the totals.
        await this.store.saveMessage({
          id: `${conversation.id}-${lineIndex}`,
          conversationId: conversation.id,
          from: line.from,
          author: line.from === 'guest' ? conversation.guestName : 'Reception',
          body: line.body,
          sentAt: minusMinutes(lastAt, line.minutesBefore),
        });
      }
      // `saveMessage` bumped unread per guest line; the thread's real count is only the trailing unanswered one.
      if (conversation.unread === 0) await this.store.markRead(conversation.id);
      else {
        await this.store.markRead(conversation.id);
        await this.store.saveConversation({ ...conversation, unread: 1 });
      }
    }
  }
}
