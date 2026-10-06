import type { MessagingStore } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import { d1MessagingStore as d1 } from './messaging-store-d1';
import { mockMessagingStore } from './messaging-store-mock';

/**
 * The messaging store the app actually uses: D1 when a binding resolves at
 * call time, the in-memory mock otherwise — same shape as
 * `durable-housekeeping-store.ts`.
 */
export const durableMessagingStore: MessagingStore = {
  countUnreadConversations(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.countUnreadConversations(db, hotelId) : mockMessagingStore.countUnreadConversations(hotelId);
  },
  listConversations(hotelId, limit) {
    const db = getDemoDatabase();
    return db ? d1.listConversations(db, hotelId, limit) : mockMessagingStore.listConversations(hotelId).then((items) => limit === undefined ? items : items.slice(0, limit));
  },
  getConversation(hotelId, id) {
    const db = getDemoDatabase();
    return db ? d1.getConversation(db, hotelId, id) : mockMessagingStore.getConversation(hotelId, id);
  },
  saveConversation(conversation) {
    const db = getDemoDatabase();
    return db ? d1.saveConversation(db, conversation) : mockMessagingStore.saveConversation(conversation);
  },
  listMessages(conversationId) {
    const db = getDemoDatabase();
    return db ? d1.listMessages(db, conversationId) : mockMessagingStore.listMessages(conversationId);
  },
  saveMessage(message) {
    const db = getDemoDatabase();
    return db ? d1.saveMessage(db, message) : mockMessagingStore.saveMessage(message);
  },
  setDeliveryStatus(messageId, status) {
    const db = getDemoDatabase();
    return db ? d1.setDeliveryStatus(db, messageId, status) : mockMessagingStore.setDeliveryStatus(messageId, status);
  },
  markRead(conversationId) {
    const db = getDemoDatabase();
    return db ? d1.markRead(db, conversationId) : mockMessagingStore.markRead(conversationId);
  },
  deleteConversation(hotelId, id) {
    const db = getDemoDatabase();
    return db ? d1.deleteConversation(db, hotelId, id) : mockMessagingStore.deleteConversation(hotelId, id);
  },
};
