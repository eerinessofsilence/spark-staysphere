import type { RoomType } from './schemas';

export const roomCategories = ['room', 'studio', 'suite', 'loft', 'residence', 'penthouse'] as const;
export type RoomCategory = (typeof roomCategories)[number];

/**
 * Guests shop by the kind of space, not by the internal room-type id. The
 * taxonomy is derived from the room name so new inventory needs no extra field.
 */
export function roomCategory(room: Pick<RoomType, 'name'>): RoomCategory {
  const name = room.name.toLowerCase();
  if (name.includes('penthouse')) return 'penthouse';
  if (name.includes('residence')) return 'residence';
  if (name.includes('loft')) return 'loft';
  if (name.includes('suite')) return 'suite';
  if (name.includes('studio')) return 'studio';
  return 'room';
}

export function hasMedia(room: Pick<RoomType, 'media'>, type: RoomType['media'][number]['type']): boolean {
  return room.media.some((item) => item.type === type);
}
