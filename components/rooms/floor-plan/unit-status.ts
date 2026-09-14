import type { FloorPlanStatus, FloorPlanUnit } from '@/lib/application/inventory-service';
import type { RoomCategory } from '@/lib/domain/room-attributes';

/** Fits a 44px cell under the room number; the full word is in the cell's label. */
export const categoryShort: Record<RoomCategory, string> = {
  room: 'Room',
  studio: 'Studio',
  suite: 'Suite',
  loft: 'Loft',
  residence: 'Res.',
  penthouse: 'Penth.',
};

export function unitStatusWords(unit: FloorPlanUnit, guests: number): string {
  switch (unit.status) {
    case 'available':
      return 'Free for your dates';
    case 'booked':
      return 'Booked on at least one of your nights';
    case 'unsuitable':
      return `Sleeps up to ${unit.capacity}, not enough for ${guests}`;
    case 'filtered':
      return 'Hidden by your filters';
  }
}

export const hatch = {
  backgroundImage:
    'repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in srgb, currentColor 22%, transparent) 4px 5px)',
};

export const statusSurface: Record<FloorPlanStatus, string> = {
  available: 'bg-tint-sage text-tint-sage-ink',
  booked: 'bg-stone text-muted-foreground',
  unsuitable: 'border border-dashed border-muted-foreground/50 text-muted-foreground',
  filtered: 'bg-stone/40 text-muted-foreground opacity-50',
};
