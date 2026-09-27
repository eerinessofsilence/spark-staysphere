'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, getAdminMember, requireBackOfficeSession, requirePermission } from '@/lib/application/admin-session';
import { reportsService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { isReportPeriodView, isReportType } from '@/lib/domain/reports';
import { getAdminT } from '@/lib/i18n/admin/server';

export interface GenerateReportResult {
  ok: boolean;
  message: string;
  id?: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Runs the same query the "Online" tab does, but freezes the result into a
 * `GeneratedReport` the "Generated" tab's grid lists — see `reports-service.ts`.
 */
export async function generateReportAction(type: string, date: string): Promise<GenerateReportResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  if (!isReportType(type) || !ISO_DAY.test(date)) return { ok: false, message: t('reports.invalidRequest') };

  const member = await getAdminMember();
  const report = await reportsService.generate(await getSelectedHotelSlug(), type, date, member?.name ?? t('reports.unknownMember'));
  revalidatePath('/admin/accounting/reports/generated');
  return { ok: true, message: t('reports.generated'), id: report.id };
}

/**
 * `generateReportAction`'s counterpart for "Manager analytics"/"Financial"/
 * "Guest ledger"/"Statistics" — freezes the period, not a single day, into a
 * `GeneratedReport` the "Generated" tab's grid lists.
 */
export async function generatePeriodReportAction(view: string, from: string, to: string): Promise<GenerateReportResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  if (!isReportPeriodView(view) || !ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) {
    return { ok: false, message: t('reports.invalidRequest') };
  }

  const member = await getAdminMember();
  const report = await reportsService.generatePeriod(
    await getSelectedHotelSlug(),
    view,
    from,
    to,
    toIsoDate(new Date()),
    member?.name ?? t('reports.unknownMember'),
  );
  revalidatePath('/admin/accounting/reports/generated');
  return { ok: true, message: t('reports.generated'), id: report.id };
}

/** Fills an empty "Generated" tab with one of each report type for today — see `ReportsService.generateSamples`. */
export async function addSampleReportsAction(): Promise<{ created: number }> {
  await requireBackOfficeSession();
  const t = await getAdminT();
  const hotelSlug = await getSelectedHotelSlug();
  const member = await getAdminMember();
  const result = await reportsService.generateSamples(hotelSlug, toIsoDate(new Date()), member?.name ?? t('reports.unknownMember'));
  revalidatePath('/admin/accounting/reports/generated');
  return result;
}
