'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { housekeepingService } from '@/lib/application/container';
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
): Promise<HousekeepingActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permHousekeeping');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }

  const result = await housekeepingService.setStatus(
    await getSelectedHotelSlug(),
    unitId,
    status,
    note,
    toIsoDate(new Date()),
  );
  if (!result.ok) {
    return {
      ok: false,
      message: result.error === 'roomNotFound' ? t('housekeeping.roomNotFound') : t('housekeeping.invalidStatus'),
    };
  }

  revalidatePath('/admin/housekeeping');
  revalidatePath('/admin/housekeeping/[id]', 'page');
  return {
    ok: true,
    message: t('housekeeping.saved', {
      room: result.room.unit.number,
      status: t(housekeepingStatusKey(result.room.status)).toLowerCase(),
    }),
  };
}
