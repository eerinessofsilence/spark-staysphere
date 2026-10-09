import { availableHotels, catalogService, maintenanceIssueService, teamService } from '@/lib/application/container';
import { AdminAuthError, requireAdminSession } from '@/lib/application/admin-session';

export async function DELETE(request: Request, { params }: { params: Promise<{ issueId: string; photoId: string }> }): Promise<Response> {
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'forbidden' }, { status: 403 });
    const slug = new URL(request.url).searchParams.get('hotel');
    const hotel = availableHotels.find((candidate) => candidate.slug === slug);
    if (!member || !hotel) return Response.json({ error: 'notFound' }, { status: 404 });
    const { issueId, photoId } = await params;
    const result = await maintenanceIssueService.removePhoto(hotel.id, issueId, photoId, member);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.error === 'forbidden' ? 403 : result.error === 'notFound' ? 404 : 503 });
    return Response.json({ photoCount: result.issue.photos.length });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401 });
    console.error('Maintenance photo removal failed', error);
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ issueId: string; photoId: string }> }): Promise<Response> {
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    const slug = new URL(request.url).searchParams.get('hotel');
    const { issueId, photoId } = await params;
    if (!member || !slug || !availableHotels.some((hotel) => hotel.slug === slug)) return new Response(null, { status: 404 });
    const hotel = await catalogService.getHotel(slug);
    const file = await maintenanceIssueService.readPhoto(hotel.id, issueId, photoId, member);
    if (!file) return new Response(null, { status: 404 });
    return new Response(file.body, { headers: { 'Content-Type': file.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response(null, { status: 401 });
    console.error('Maintenance photo read failed', error);
    return new Response(null, { status: 503 });
  }
}
