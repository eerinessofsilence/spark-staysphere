import { availableHotels, maintenanceIssueService, teamService } from '@/lib/application/container';
import { AdminAuthError, requireAdminSession } from '@/lib/application/admin-session';
import { MAX_MAINTENANCE_DESCRIPTION, MAX_MAINTENANCE_PHOTOS, MAX_MAINTENANCE_PHOTO_BYTES } from '@/lib/application/maintenance-issue-service';
import { maintenancePhotoViews } from '@/lib/application/maintenance-photo';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    if (!member || member.status !== 'active' || member.role !== 'Housekeeper' || !(await teamService.hasPermission(member.role, 'team.permHousekeeping'))) {
      return Response.json({ error: 'forbidden' }, { status: 403, headers });
    }
    const hotelSlug = new URL(request.url).searchParams.get('hotel');
    if (!hotelSlug || !availableHotels.some((hotel) => hotel.slug === hotelSlug)) {
      return Response.json({ error: 'invalid_hotel' }, { status: 400, headers });
    }
    const issues = await maintenanceIssueService.listForHousekeeper(hotelSlug, member);
    return Response.json({ issues }, { headers });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401, headers });
    console.error('Housekeeper maintenance status read failed', error);
    return Response.json({ error: 'unavailable' }, { status: 503, headers });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdminSession();
    const reporter = await teamService.findMemberById(session.memberId);
    if (!reporter || reporter.role !== 'Housekeeper') return Response.json({ error: 'forbidden' }, { status: 403 });
    const length = Number(request.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_MAINTENANCE_PHOTOS * MAX_MAINTENANCE_PHOTO_BYTES + 100_000) return Response.json({ error: 'payload_too_large' }, { status: 413 });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'forbidden' }, { status: 403 });
    const data = await request.formData();
    const hotelSlug = String(data.get('hotelSlug') ?? '');
    const unitId = String(data.get('unitId') ?? '');
    const category = String(data.get('category') ?? '');
    const description = String(data.get('description') ?? '');
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (!availableHotels.some((hotel) => hotel.slug === hotelSlug)) return Response.json({ error: 'invalid_hotel' }, { status: 400 });
    const uploads = data.getAll('photos');
    if (uploads.length < 1 || uploads.length > MAX_MAINTENANCE_PHOTOS || uploads.some((file) => !(file instanceof File) || file.size > MAX_MAINTENANCE_PHOTO_BYTES)) {
      return Response.json({ error: 'invalid_photos' }, { status: 400 });
    }
    if (description.length > MAX_MAINTENANCE_DESCRIPTION) return Response.json({ error: 'invalid_description' }, { status: 400 });
    const views = maintenancePhotoViews(data, uploads.length);
    if (!views) return Response.json({ error: 'invalid_photos' }, { status: 400 });
    const photos = await Promise.all((uploads as File[]).map(async (file, index) => ({ bytes: await file.arrayBuffer(), contentType: file.type, view: views[index] })));
    const result = await maintenanceIssueService.create({ hotelSlug, unitId, category, description, reporter, idempotencyKey, photos });
    if (!result.ok) {
      const status = result.error === 'forbidden' ? 403 : result.error === 'storageUnavailable' ? 503 : 400;
      return Response.json({ error: result.error }, { status });
    }
    return Response.json({ issueId: result.issue.id, created: result.created, notificationCount: result.notificationCount }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401 });
    console.error('Maintenance issue creation failed', error);
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
