'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminT } from '@/lib/i18n/admin/server';

/**
 * `/admin/groups` — a shared reservation the desk names, then attaches
 * existing bookings to. Creating and attaching sit behind `permViewBookings`
 * (the same permission that books a walk-in on the front desk); detaching a
 * booking or deleting the group behind `permCancelBookings`, since both
 * undo something already on the books — the same split `app/admin/bookings/actions.ts`
 * already draws between check-in/out and cancel.
 */

function revalidateGroupViews() {
  revalidatePath('/admin/groups');
  revalidatePath('/admin/groups/[id]', 'page');
  revalidatePath('/admin/bookings/[reference]', 'page');
}

export interface GroupActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2000).optional(),
});

export async function createGroupAction(input: unknown): Promise<GroupActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t('groups.invalidName') };

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const group = await hotelRepository.createBookingGroup({
    id: crypto.randomUUID(),
    hotelId: hotel.id,
    name: parsed.data.name,
    notes: parsed.data.notes || undefined,
    createdAt: new Date().toISOString(),
  });

  revalidateGroupViews();
  return { ok: true, message: t('groups.created', { name: group.name }), id: group.id };
}

export async function assignBookingToGroupAction(groupId: string, bookingId: string): Promise<GroupActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  if (!bookingId) return { ok: false, message: t('groups.pickBooking') };

  const updated = await hotelRepository.assignBookingToGroup(bookingId, groupId);
  if (!updated) return { ok: false, message: t('groups.bookingNotFound') };

  revalidateGroupViews();
  return { ok: true, message: t('groups.bookingAttached', { reference: updated.reference }) };
}

export async function removeBookingFromGroupAction(bookingId: string): Promise<GroupActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permCancelBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const updated = await hotelRepository.removeBookingFromGroup(bookingId);
  if (!updated) return { ok: false, message: t('groups.bookingNotFound') };

  revalidateGroupViews();
  return { ok: true, message: t('groups.bookingRemoved', { reference: updated.reference }) };
}

export async function deleteGroupAction(groupId: string): Promise<GroupActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permCancelBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  await hotelRepository.deleteBookingGroup(groupId);
  revalidateGroupViews();
  return { ok: true, message: t('groups.deleted') };
}
