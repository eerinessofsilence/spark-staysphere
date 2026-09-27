'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, getAdminMember, requirePermission } from '@/lib/application/admin-session';
import { communicationsService } from '@/lib/application/container';
import { MESSAGE_MAX } from '@/lib/application/communications-service';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { ConversationChannel } from '@/lib/domain/ports';
import { getAdminT } from '@/lib/i18n/admin/server';

export type CommsActionResult = { ok: true; id: string } | { ok: false; message: string };

const CHANNELS: ConversationChannel[] = ['chat', 'email', 'whatsapp', 'sms'];

/** Both writes sit behind the desk's own permission: whoever may see a booking may talk to its guest. */
async function permitted(): Promise<{ ok: true; author: string } | { ok: false; message: string }> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const member = await getAdminMember();
  return { ok: true, author: member?.name ?? t('comms.reception') };
}

export async function sendMessageAction(conversationId: string, body: string): Promise<CommsActionResult> {
  const t = await getAdminT();
  const gate = await permitted();
  if (!gate.ok) return gate;
  const result = await communicationsService.send(await getSelectedHotelSlug(), conversationId, body, gate.author);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.error === 'empty' ? t('comms.errorEmpty')
        : result.error === 'tooLong' ? t('comms.errorTooLong', { max: String(MESSAGE_MAX) })
        : t('comms.errorNotFound'),
    };
  }
  revalidatePath('/admin/communications');
  revalidatePath(`/admin/communications/${conversationId}`);
  return { ok: true, id: result.message.id };
}

export async function startConversationAction(bookingReference: string, channel: string): Promise<CommsActionResult> {
  const t = await getAdminT();
  const gate = await permitted();
  if (!gate.ok) return gate;
  const picked = CHANNELS.find((option) => option === channel) ?? 'chat';
  const result = await communicationsService.start(await getSelectedHotelSlug(), bookingReference, picked);
  if (!result.ok) return { ok: false, message: t('comms.start.bookingNotFound') };
  revalidatePath('/admin/communications');
  return { ok: true, id: result.conversation.id };
}
