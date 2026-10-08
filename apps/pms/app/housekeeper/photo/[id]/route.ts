import { getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, housekeepingService, teamService } from '@/lib/application/container';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return new Response(null, { status: 401 });
  if (session.tenantAccount) return new Response(null, { status: 403 });
  const member = await teamService.findMemberById(session.memberId);
  if (!member || (member.role !== 'Housekeeper' && !(await teamService.hasPermission(member.role, 'team.permHousekeeping')))) return new Response(null, { status: 403 });
  const id = (await params).id;
  const event = (await Promise.all(availableHotels.map((hotel) => housekeepingService.getEvent(hotel.slug, id)))).find(Boolean);
  if (!event?.photoData || (member.role === 'Housekeeper' && event.memberId !== member.id)) return new Response(null, { status: 404 });
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(event.photoData);
  if (!match) return new Response(null, { status: 404 });
  const bytes = Uint8Array.from(atob(match[2]!), (char) => char.charCodeAt(0));
  return new Response(bytes, { headers: { 'Content-Type': match[1]!, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
