'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { availableHotels, housekeepingService, teamService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import type { HousekeepingStatus } from '@/lib/domain/schemas';
import { housekeepingStatusKey } from '@/lib/i18n/admin/housekeeping';
import { getAdminT } from '@/lib/i18n/admin/server';

export interface HousekeepingActionResult {
  ok: boolean;
  message: string;
}

/**
 * The one write on the board: an attendant or the desk moves a room to a
 * status, optionally leaving a note. Behind its own permission
 * (`permHousekeeping`) rather than the desk's, so a housekeeping role can
 * be given exactly this and nothing of the bookings.
 */
export async function setHousekeepingStatusAction(
  unitId: string,
  status: HousekeepingStatus,
  note: string,
  photoData: string | null = null,
  eventId: string = crypto.randomUUID(),
  hotelSlug?: string,
): Promise<HousekeepingActionResult> {
  const t = await getAdminT();
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission('team.permHousekeeping');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const member = await teamService.findMemberById(session.memberId);
  const selectedSlug = member?.role === 'Housekeeper' && hotelSlug && availableHotels.some((hotel) => hotel.slug === hotelSlug)
    ? hotelSlug : await getSelectedHotelSlug();
  const result = await housekeepingService.setStatus(
    selectedSlug,
    unitId,
    status,
    note,
    toIsoDate(new Date()),
    { memberId: session.memberId, assignedOnly: member?.role === 'Housekeeper', eventId, photoData },
  );
  if (!result.ok) {
    return {
      ok: false,
      message: result.error === 'roomNotFound' ? t('housekeeping.roomNotFound')
        : result.error === 'notAssigned' ? 'Этот номер вам не назначен.'
        : result.error === 'photoRequired' ? 'Для статуса «Чисто» добавьте фото.'
        : result.error === 'invalidPhoto' ? 'Фото должно быть JPEG, PNG или WebP до 700 КБ.'
        : t('housekeeping.invalidStatus'),
    };
  }

  revalidatePath('/admin/housekeeping');
  revalidatePath('/admin/housekeeping/[id]', 'page');
  revalidatePath('/housekeeper');
  return {
    ok: true,
    message: t('housekeeping.saved', {
      room: result.room.unit.number,
      status: t(housekeepingStatusKey(result.room.status)).toLowerCase(),
    }),
  };
}

export async function assignHousekeepingRoomAction(unitId: string, memberId: string | null): Promise<HousekeepingActionResult> {
  await requirePermission('team.permTeamRoles');
  if (memberId) {
    const member = await teamService.findMemberById(memberId);
    if (!member || member.role !== 'Housekeeper') return { ok: false, message: 'Выберите сотрудника хаускипинга.' };
  }
  const ok = await housekeepingService.assignRoom(await getSelectedHotelSlug(), unitId, memberId);
  if (!ok) return { ok: false, message: 'Номер не найден.' };
  revalidatePath('/admin/housekeeping');
  revalidatePath('/housekeeper');
  return { ok: true, message: 'Назначение сохранено.' };
}
