'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { playBookingChime } from './new-booking-notifier';
import { toast } from './toast';

interface UnreadMessageConversation {
  id: string;
  guestName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  hotelSlug: string;
}

export function NewMessageNotifier({
  hotelSlugs,
  initialConversations,
}: {
    hotelSlugs: string[];
  initialConversations: UnreadMessageConversation[];
}) {
  const t = useAdminT();
  const seen = React.useRef(new Map(initialConversations.map((conversation) => [conversation.id, `${conversation.lastMessageAt}\n${conversation.lastMessage}`])));
  const audio = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    seen.current = new Map(initialConversations.map((conversation) => [conversation.id, `${conversation.lastMessageAt}\n${conversation.lastMessage}`]));
    let active = true;
    let checking = false;

    const unlockSound = () => {
      if (!audio.current) {
        const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextConstructor) audio.current = new AudioContextConstructor();
      }
      if (audio.current?.state === 'suspended') void audio.current.resume().catch(() => {});
    };
    document.addEventListener('pointerdown', unlockSound);
    document.addEventListener('keydown', unlockSound);

    const checkForMessages = async () => {
      if (!active || checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const snapshots = await Promise.all(hotelSlugs.map(async (hotelSlug) => {
          const response = await fetch(`/api/admin/message-notifications?hotel=${encodeURIComponent(hotelSlug)}`, { cache: 'no-store' });
          if (!response.ok) return null;
          return { hotelSlug, result: await response.json() as { unreadCount?: number; conversations?: Omit<UnreadMessageConversation, 'hotelSlug'>[] } };
        }));
        const available = snapshots.filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null);
        if (available.length === 0) return;
        const conversations = available.flatMap(({ hotelSlug, result }) => (result.conversations ?? []).map((conversation) => ({ ...conversation, hotelSlug })));
        const unreadCount = available.reduce((total, { result }) => total + (result.unreadCount ?? result.conversations?.length ?? 0), 0);
        const fresh = conversations.filter((conversation) => {
          const signature = `${conversation.lastMessageAt}\n${conversation.lastMessage}`;
          return seen.current.get(conversation.id) !== signature;
        });
        for (const conversation of conversations) {
          seen.current.set(conversation.id, `${conversation.lastMessageAt}\n${conversation.lastMessage}`);
        }
        window.dispatchEvent(new CustomEvent('admin-unread-messages', {
          detail: { conversations, unreadCount },
        }));
        for (const conversation of fresh) {
          toast.action(
            t('comms.newMessageToast', { guest: conversation.guestName }),
            `/admin/communications/${conversation.id}?hotel=${encodeURIComponent(conversation.hotelSlug)}`,
            t('comms.openMessage'),
          );
        }
        if (fresh.length > 0) playBookingChime(audio.current);
      } catch {
        // The communications page remains usable while live notifications retry.
      } finally {
        checking = false;
      }
    };

    const timer = window.setInterval(() => void checkForMessages(), 6000);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('pointerdown', unlockSound);
      document.removeEventListener('keydown', unlockSound);
      audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, [hotelSlugs, initialConversations, t]);

  return null;
}
