import type { FloorPlanStatus, FloorPlanUnit } from '@/lib/application/inventory-service';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

export function unitStatusWords(
  unit: FloorPlanUnit,
  guests: number,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  switch (unit.status) {
    case 'available':
      return t('rooms.freeForYourDates');
    case 'booked':
      return t('rooms.bookedOnAtLeastOneNight');
    case 'unsuitable':
      return t('rooms.notEnoughForGuests', { capacity: String(unit.capacity), guests: String(guests) });
    case 'filtered':
      return t('rooms.hiddenByYourFilters');
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
