import type { CatalogReader, SpinnerMarkupPort } from '../domain/ports';
import type { AddOn, Hotel, PhysicalRoom, RoomType } from '../domain/schemas';
import type { SpinnerPolygon, SpinnerZone } from '../domain/spinner-markup';
import { facadeOf } from '../domain/room-units';
export class HotelNotFoundError extends Error {
  constructor(slug: string) {
    super(`No hotel is published at "${slug}".`);
    this.name = 'HotelNotFoundError';
  }
}

export class RoomNotFoundError extends Error {
  constructor(slug: string) {
    super(`No room type is published at "${slug}".`);
    this.name = 'RoomNotFoundError';
  }
}

/**
 * A spinner-markup zone (`lib/domain/spinner-markup.ts`) resolved for a
 * guest: its target's catalog reference is followed and turned into
 * whatever the overlay needs to render and link to. A zone whose target no
 * longer resolves — a deleted unit, a hidden or deleted room type — is
 * dropped entirely rather than shown broken; see `getSpinnerZones`.
 */
export type GuestSpinnerZone = { id: string; frameIndex: number; polygon: SpinnerPolygon } & (
  | { kind: 'unit'; roomSlug: string; unitNumber: string; floor: number; href: string }
  | { kind: 'roomType'; roomSlug: string; href: string }
  | { kind: 'floor'; floor: number; facade: 'sea' | 'town' | null; roomNames: string[]; href: string }
  | { kind: 'link'; label: string; description: string; cta: string; href: string }
);

export class CatalogService {
  constructor(private readonly repository: CatalogReader, private readonly spinnerMarkup: SpinnerMarkupPort) {}
  async getHotel(slug: string): Promise<Hotel> {
    const hotel = await this.repository.getHotel(slug);
    if (!hotel) throw new HotelNotFoundError(slug);

    const rooms = await this.repository.listRooms(hotel.id);
    const hiddenSlugs = new Set(rooms.filter((room) => room.hidden).map((room) => room.slug));
    if (hiddenSlugs.size === 0) return hotel;

    return {
      ...hotel,
      areas: hotel.areas.map((area) => ({
        ...area,
        hotspots: area.hotspots.filter((hotspot) => !hotspot.roomSlug || !hiddenSlugs.has(hotspot.roomSlug)),
        roomZones: area.roomZones?.filter((zone) => !hiddenSlugs.has(zone.roomSlug)),
      })),
      spinner: hotel.spinner
        ? {
            ...hotel.spinner,
            hotspots: hotel.spinner.hotspots.filter(
              (hotspot) => !hotspot.roomSlug || !hiddenSlugs.has(hotspot.roomSlug),
            ),
          }
        : hotel.spinner,
    };
  }

  /**
   * The zones drawn in `/admin/content/spinner`, resolved for a guest: each
   * target is followed through the current catalog (never the CMS's raw
   * `spinnerMarkup.listZones`, the same way `getHotel` never hands back raw
   * seed hotspots) so a hidden room type, a deleted unit, or a zone nobody
   * has bound yet never reaches the spinner. Independent of `Hotel.spinner`
   * — see `lib/domain/spinner-markup.ts`.
   */
  async getSpinnerZones(slug: string): Promise<GuestSpinnerZone[]> {
    if (!this.spinnerMarkup) return [];
    const hotel = await this.repository.getHotel(slug);
    if (!hotel) throw new HotelNotFoundError(slug);

    const [zones, rooms, units] = await Promise.all([
      this.spinnerMarkup.listZones(hotel.id),
      this.repository.listRooms(hotel.id),
      this.repository.listPhysicalRooms(hotel.id),
    ]);
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));

    const resolved: GuestSpinnerZone[] = [];
    for (const zone of zones) {
      const guest = this.resolveZoneTarget(zone, roomById, unitById);
      if (guest) resolved.push(guest);
    }
    return resolved;
  }

  private resolveZoneTarget(
    zone: SpinnerZone,
    roomById: Map<string, RoomType>,
    unitById: Map<string, PhysicalRoom>,
  ): GuestSpinnerZone | null {
    const base = { id: zone.id, frameIndex: zone.frameIndex, polygon: zone.polygon };
    if (!zone.target) return null;

    switch (zone.target.kind) {
      case 'unit': {
        const unit = unitById.get(zone.target.unitId);
        const room = unit ? roomById.get(unit.roomTypeId) : undefined;
        if (!unit || !room || room.hidden) return null;
        return { ...base, kind: 'unit', roomSlug: room.slug, unitNumber: unit.number, floor: unit.floor, href: `/rooms/${room.slug}?room=${encodeURIComponent(unit.number)}` };
      }
      case 'roomType': {
        const room = roomById.get(zone.target.roomTypeId);
        if (!room || room.hidden) return null;
        return { ...base, kind: 'roomType', roomSlug: room.slug, href: `/rooms/${room.slug}` };
      }
      case 'floor':
        return this.resolveFloorZone(base, zone.target, roomById);
      case 'link':
        return { ...base, kind: 'link', label: zone.target.label, description: zone.target.description, cta: zone.target.cta, href: zone.target.href };
      default:
        return null;
    }
  }

  private resolveFloorZone(
    base: { id: string; frameIndex: number; polygon: SpinnerPolygon },
    target: Extract<SpinnerZone['target'], { kind: 'floor' }>,
    roomById: Map<string, RoomType>,
  ): GuestSpinnerZone | null {
    const onFloor = [...roomById.values()].filter(
      (room) => !room.hidden && room.floor === target.floor && (!target.facade || facadeOf(room.view) === target.facade),
    );
    if (onFloor.length === 0) return null;
    const href = `/rooms?minFloor=${target.floor}${target.facade === 'sea' ? '&view=sea&view=pool' : target.facade === 'town' ? '&view=garden&view=city' : ''}&layout=plan`;
    return { ...base, kind: 'floor', floor: target.floor, facade: target.facade, roomNames: onFloor.map((room) => room.name), href };
  }

  async listAddOns(hotelId: string): Promise<AddOn[]> {
    return this.repository.listAddOns(hotelId);
  }

}
