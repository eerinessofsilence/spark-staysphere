'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/application/admin-session';
import { availableHotels, catalogService, maintenanceIssueService, teamService } from '@/lib/application/container';
import type { MaintenanceIssueStatus } from '@/lib/domain/maintenance-issue';
import { maintenanceIssueStatusSchema } from '@/lib/domain/maintenance-issue';
import { getAdminT } from '@/lib/i18n/admin/server';
import { z } from 'zod';

const issueInputSchema = z.object({ issueId: z.uuid(), hotelSlug: z.string().min(1) });

export async function updateMaintenanceIssueStatusAction(issueId: string, hotelSlug: string, status: MaintenanceIssueStatus) {
  const t = await getAdminT();
  const parsed = issueInputSchema.extend({ status: maintenanceIssueStatusSchema }).safeParse({ issueId, hotelSlug, status });
  if (!parsed.success) return { ok: false, message: t('maintenance.failed') };
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    if (!member || !availableHotels.some((hotel) => hotel.slug === hotelSlug)) return { ok: false, message: t('team.permissionDenied') };
    const hotel = await catalogService.getHotel(hotelSlug);
    const issue = await maintenanceIssueService.getForHotelier(hotel.id, issueId, member);
    if (parsed.data.status === 'Resolved' && issue?.replacement?.status === 'Pending') return { ok: false, message: t('maintenance.replacementPendingClose') };
    const updated = await maintenanceIssueService.updateStatus(hotel.id, issueId, parsed.data.status, member);
    if (!updated) return { ok: false, message: t('maintenance.notFound') };
    revalidatePath('/admin/maintenance');
    revalidatePath(`/admin/maintenance/${issueId}`);
    return { ok: true, message: t('maintenance.saved') };
  } catch {
    return { ok: false, message: t('maintenance.failed') };
  }
}

export async function requestMaintenanceReplacementAction(issueId: string, hotelSlug: string, reason: string) {
  const t = await getAdminT();
  if (!issueInputSchema.extend({ reason: z.string().trim().min(1).max(1000) }).safeParse({ issueId, hotelSlug, reason }).success) {
    return { ok: false, message: t('maintenance.replacementReasonRequired') };
  }
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    if (!member || !availableHotels.some((hotel) => hotel.slug === hotelSlug)) return { ok: false, message: t('team.permissionDenied') };
    const hotel = await catalogService.getHotel(hotelSlug);
    const result = await maintenanceIssueService.requestReplacement(hotel.id, issueId, reason, member);
    if (!result.ok) return { ok: false, message: t(result.error === 'noHotelier' ? 'maintenance.replacementNoHotelier' : result.error === 'forbidden' ? 'team.permissionDenied' : 'maintenance.replacementFailed') };
    revalidatePath('/admin/maintenance');
    revalidatePath(`/admin/maintenance/${issueId}`);
    return { ok: true, message: t('maintenance.replacementRequested') };
  } catch { return { ok: false, message: t('maintenance.replacementFailed') }; }
}

export async function approveMaintenanceReplacementAction(issueId: string, hotelSlug: string) {
  const t = await getAdminT();
  if (!issueInputSchema.safeParse({ issueId, hotelSlug }).success) return { ok: false, message: t('maintenance.replacementFailed') };
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    if (!member || !availableHotels.some((hotel) => hotel.slug === hotelSlug)) return { ok: false, message: t('team.permissionDenied') };
    const hotel = await catalogService.getHotel(hotelSlug);
    const result = await maintenanceIssueService.approveReplacement(hotel.id, issueId, member);
    if (!result.ok) return { ok: false, message: t(result.error === 'forbidden' ? 'team.permissionDenied' : 'maintenance.replacementFailed') };
    revalidatePath('/admin/maintenance');
    revalidatePath(`/admin/maintenance/${issueId}`);
    return { ok: true, message: t('maintenance.replacementApproved') };
  } catch { return { ok: false, message: t('maintenance.replacementFailed') }; }
}

export async function markMaintenanceIssueReadAction(issueId: string, hotelSlug: string) {
  if (!issueInputSchema.safeParse({ issueId, hotelSlug }).success) return { ok: false };
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    if (!member || !availableHotels.some((hotel) => hotel.slug === hotelSlug)) return { ok: false };
    const hotel = await catalogService.getHotel(hotelSlug);
    if (!(await maintenanceIssueService.canManageHotel(member, hotel.id))) return { ok: false };
    await maintenanceIssueService.markIssueNotificationsRead(hotel.id, issueId, member);
    return { ok: true };
  } catch { return { ok: false }; }
}
