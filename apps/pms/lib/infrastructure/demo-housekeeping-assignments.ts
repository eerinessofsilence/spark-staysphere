import { demoHotel, demoPhysicalRooms } from './mock-data';

/** A useful tablet demo without creating extra physical rooms or changing inventory. */
export const demoHousekeepingAssignments = demoPhysicalRooms
  .filter((room) => room.hotelId === demoHotel.id)
  .filter((_, index) => index % 2 === 0)
  .slice(0, 16)
  .map((room) => ({ hotelId: room.hotelId, unitId: room.id, memberId: 'housekeeper-demo' }));
