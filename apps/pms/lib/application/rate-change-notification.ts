import { requirePermission } from './admin-session';
import { catalogService, contentServiceFor, recordRateChange, teamService } from './container';
import { getSelectedHotelSlug } from './hotel-context';

/** Best-effort audit notification after a successful, version-checked rate mutation. */
export async function notifyRateChange(roomTypeId: string, rateId: string, description: string): Promise<void> {
  try {
    const session = await requirePermission('team.permEditRates');
    const hotelSlug = await getSelectedHotelSlug();
    const [hotel, member, rates] = await Promise.all([
      catalogService.getHotel(hotelSlug),
      teamService.findMemberById(session.memberId),
      contentServiceFor(hotelSlug).listRatesContent(roomTypeId),
    ]);
    const rate = rates.find((item) => item.id === rateId);
    if (!rate) return;
    await recordRateChange({ id: crypto.randomUUID(), hotelId: hotel.id, rateId, rateName: rate.name,
      roomTypeId, actorName: member?.name ?? 'Administrator', description, occurredAt: new Date().toISOString() });
  } catch (error) {
    console.error('Rate saved but notification could not be recorded', error);
  }
}
