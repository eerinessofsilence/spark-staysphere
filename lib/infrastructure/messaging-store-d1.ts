import type { ChatMessage, Conversation, ConversationChannel, MessagingStore } from '../domain/ports';
import { ensureSchema } from './d1-schema';

/**
 * D1-backed half of `MessagingStore`. Two tables: a thread row that carries
 * the list's denormalised "last message" fields, and one row per message.
 */

interface ConversationRow {
  id: string;
  hotel_id: string;
  channel: ConversationChannel;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  booking_reference: string | null;
  last_message: string;
  last_message_at: string;
  unread: number;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender: ChatMessage['from'];
  author: string;
  body: string;
  sent_at: string;
}

const CONVERSATION_COLUMNS =
  'id, hotel_id, channel, guest_name, guest_email, guest_phone, booking_reference, last_message, last_message_at, unread, created_at';

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    channel: row.channel,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    bookingReference: row.booking_reference,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unread: row.unread,
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): ChatMessage {
  return { id: row.id, conversationId: row.conversation_id, from: row.sender, author: row.author, body: row.body, sentAt: row.sent_at };
}

export const d1MessagingStore = {
  async listConversations(db: D1Database, hotelId: string): Promise<Conversation[]> {
    await ensureSchema(db);
    const { results } = await db
      .prepare(`SELECT ${CONVERSATION_COLUMNS} FROM conversations WHERE hotel_id = ? ORDER BY last_message_at DESC`)
      .bind(hotelId)
      .all<ConversationRow>();
    return results.map(toConversation);
  },

  async getConversation(db: D1Database, hotelId: string, id: string): Promise<Conversation | null> {
    await ensureSchema(db);
    const row = await db
      .prepare(`SELECT ${CONVERSATION_COLUMNS} FROM conversations WHERE hotel_id = ? AND id = ?`)
      .bind(hotelId, id)
      .first<ConversationRow>();
    return row ? toConversation(row) : null;
  },

  async saveConversation(db: D1Database, c: Conversation): Promise<void> {
    await ensureSchema(db);
    await db
      .prepare(
        `INSERT INTO conversations (${CONVERSATION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET last_message = excluded.last_message, last_message_at = excluded.last_message_at, unread = excluded.unread`,
      )
      .bind(c.id, c.hotelId, c.channel, c.guestName, c.guestEmail, c.guestPhone, c.bookingReference, c.lastMessage, c.lastMessageAt, c.unread, c.createdAt)
      .run();
  },

  async listMessages(db: D1Database, conversationId: string): Promise<ChatMessage[]> {
    await ensureSchema(db);
    const { results } = await db
      .prepare('SELECT id, conversation_id, sender, author, body, sent_at FROM conversation_messages WHERE conversation_id = ? ORDER BY sent_at ASC')
      .bind(conversationId)
      .all<MessageRow>();
    return results.map(toMessage);
  },

  async saveMessage(db: D1Database, m: ChatMessage): Promise<void> {
    await ensureSchema(db);
    await db.batch([
      db
        .prepare('INSERT OR IGNORE INTO conversation_messages (id, conversation_id, sender, author, body, sent_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(m.id, m.conversationId, m.from, m.author, m.body, m.sentAt),
      // Gated on the insert having landed: a replayed message id (an offline
      // retry) must not bump the thread's unread count a second time.
      db
        .prepare('UPDATE conversations SET last_message = ?, last_message_at = ?, unread = CASE WHEN ? = ? THEN unread + 1 ELSE unread END WHERE changes() > 0 AND id = ?')
        .bind(m.body, m.sentAt, m.from, 'guest', m.conversationId),
    ]);
  },

  async markRead(db: D1Database, conversationId: string): Promise<void> {
    await ensureSchema(db);
    await db.prepare('UPDATE conversations SET unread = 0 WHERE id = ?').bind(conversationId).run();
  },
} satisfies {
  [K in keyof MessagingStore]: (db: D1Database, ...args: Parameters<MessagingStore[K]>) => ReturnType<MessagingStore[K]>;
};
