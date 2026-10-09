import type { Metadata } from 'next';
import { getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, housekeepingService, teamService } from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';
import { HousekeeperBoard } from '@/components/admin/housekeeping/housekeeper-board';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Мои номера · Housekeeping' };

export default async function HousekeeperPage() {
  const session = await getAdminSession();
  const member = session ? await teamService.findMemberById(session.memberId) : null;
  if (!member || member.role !== 'Housekeeper') return null;
  const groups = await Promise.all(availableHotels.map(async (hotel) => ({ hotel,
    rooms: await housekeepingService.listAssignedRooms(hotel.slug, toIsoDate(new Date()), member.id),
  })));
  return <HousekeeperBoard scope={member.id} memberName={member.name} rooms={groups.flatMap(({ hotel, rooms }) => rooms.map((room) => ({
    unitId: room.unit.id, hotelSlug: hotel.slug, hotelName: hotel.name,
    number: room.unit.number, floor: room.unit.floor, roomTypeName: room.roomTypeName, status: room.status,
  })))} />;
}
