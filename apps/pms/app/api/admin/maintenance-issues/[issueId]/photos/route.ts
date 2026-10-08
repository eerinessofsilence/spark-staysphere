import { availableHotels, maintenanceIssueService, teamService } from '@/lib/application/container';
import { AdminAuthError, requireAdminSession } from '@/lib/application/admin-session';
import { MAX_MAINTENANCE_PHOTOS, MAX_MAINTENANCE_PHOTO_BYTES } from '@/lib/application/maintenance-issue-service';
import { maintenancePhotoViews } from '@/lib/application/maintenance-photo';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ issueId: string }> }): Promise<Response> {
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    if (!member) return Response.json({ error: 'forbidden' }, { status: 403 });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'forbidden' }, { status: 403 });
    const length = Number(request.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_MAINTENANCE_PHOTOS * MAX_MAINTENANCE_PHOTO_BYTES + 100_000) return Response.json({ error: 'payload_too_large' }, { status: 413 });
    const data = await request.formData();
    const hotel = availableHotels.find((candidate) => candidate.slug === String(data.get('hotelSlug') ?? ''));
    if (!hotel) return Response.json({ error: 'invalid_hotel' }, { status: 400 });
    const uploads = data.getAll('photos');
    if (uploads.length < 1 || uploads.length > MAX_MAINTENANCE_PHOTOS || uploads.some((file) => !(file instanceof File) || file.size > MAX_MAINTENANCE_PHOTO_BYTES)) return Response.json({ error: 'invalid_photos' }, { status: 400 });
    const { issueId } = await params;
    const views = maintenancePhotoViews(data, uploads.length);
    if (!views) return Response.json({ error: 'invalid_photos' }, { status: 400 });
    const result = await maintenanceIssueService.addPhotos({ hotelId: hotel.id, issueId, member,
      idempotencyKey: String(data.get('idempotencyKey') ?? ''),
      photos: await Promise.all((uploads as File[]).map(async (file, index) => ({ bytes: await file.arrayBuffer(), contentType: file.type, view: views[index] }))),
    });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.error === 'forbidden' ? 403 : result.error === 'notFound' ? 404 : result.error === 'storageUnavailable' ? 503 : result.error === 'photoLimit' ? 409 : 400 });
    return Response.json({ issueId: result.issue.id, photoCount: result.issue.photos.length });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401 });
    console.error('Maintenance photo upload failed', error);
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
