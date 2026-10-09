import type { ChatMessage, Conversation, MessagingStore } from '../domain/ports';

/**
 * Process-local fallback for `MessagingStore` — the same semantics as
 * `messaging-store-d1.ts`, used whenever no D1 binding is configured.
 */
const conversations = new Map<string, Conversation>();
const messages = new Map<string, ChatMessage>();

export const mockMessagingStore: MessagingStore = {
  async countUnreadConversations(hotelId) {
    return [...conversations.values()].filter((conversation) => conversation.hotelId === hotelId && conversation.unread > 0).length;
  },
  async listConversations(hotelId) {
    return [...conversations.values()]
      .filter((conversation) => conversation.hotelId === hotelId)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  },
  async getConversation(hotelId, id) {
    const conversation = conversations.get(id);
    return conversation?.hotelId === hotelId ? conversation : null;
  },
  async saveConversation(conversation) {
    const existing = conversations.get(conversation.id);
    conversations.set(
      conversation.id,
      existing
        ? { ...existing, lastMessage: conversation.lastMessage, lastMessageAt: conversation.lastMessageAt, unread: conversation.unread }
        : conversation,
    );
  },
  async listMessages(conversationId) {
    return [...messages.values()]
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  },
  async saveMessage(message) {
    if (messages.has(message.id)) return;
    messages.set(message.id, message);
    const conversation = conversations.get(message.conversationId);
    if (conversation) {
      conversations.set(conversation.id, {
        ...conversation,
        lastMessage: message.body,
        lastMessageAt: message.sentAt,
        unread: message.from === 'guest' ? conversation.unread + 1 : conversation.unread,
      });
    }
  },
  async setDeliveryStatus(messageId, status) {
    const message = messages.get(messageId);
    if (message) messages.set(messageId, { ...message, deliveryStatus: status });
  },
  async markRead(conversationId) {
    const conversation = conversations.get(conversationId);
    if (conversation) conversations.set(conversationId, { ...conversation, unread: 0 });
  },
  async deleteConversation(hotelId, id) {
    const conversation = conversations.get(id);
    if (conversation?.hotelId !== hotelId) return false;
    conversations.delete(id);
    for (const [messageId, message] of messages) if (message.conversationId === id) messages.delete(messageId);
    return true;
  },
};

/** Test seam: forget everything, so each test starts from an empty inbox. */
export function resetMockMessagingStore(): void {
  conversations.clear();
  messages.clear();
}
