import { catalogService, DEMO_HOTEL_SLUG, hotelRepository } from '@/lib/application/container';

/** Read-only showcase payload. No dates, quotes, booking records or stock. */
export async function GET(): Promise<Response> {
  try {
    const hotel = await catalogService.getHotel(DEMO_HOTEL_SLUG);
    const [allRooms, units, addOns, zones] = await Promise.all([
      hotelRepository.listRooms(hotel.id), hotelRepository.listPhysicalRooms(hotel.id), hotelRepository.listAddOns(hotel.id), catalogService.getSpinnerZones(DEMO_HOTEL_SLUG),
    ]);
    const rooms = await Promise.all(allRooms.filter((room) => !room.hidden).map(async (room) => {
      const rates = await hotelRepository.listRatePlans(room.id);
      return { ...room, rates, referencePrice: rates.length ? Math.min(...rates.map((rate) => rate.nightlyPrice)) : null };
    }));
    const visibleIds = new Set(rooms.map((room) => room.id));
    return Response.json({ hotel, rooms: rooms.map(({ rates: _rates, ...room }) => room), rates: rooms.flatMap((room) => room.rates), units: units.filter((unit) => visibleIds.has(unit.roomTypeId)), addOns: addOns.filter((addOn) => addOn.enabled), zones }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('CMS catalog unavailable', error);
    return Response.json({ error: 'catalog_unavailable' }, { status: 503 });
  }
}
