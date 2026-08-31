import type { AddOn, Hotel, RatePlan, RoomType } from '../domain/schemas';

export const demoHotel: Hotel = {
  id: 'hotel_asteria',
  slug: 'asteria-cove',
  name: 'Asteria Cove',
  tagline: 'See the stay. Book the room.',
  location: 'Dalmatian Coast, Croatia',
  currency: 'EUR',
  timezone: 'Europe/Zagreb',
};

const roomSeed = [
  ['deluxe-sea', 'Deluxe Sea View', 42, 4, 2, 'king', 'sea', 348],
  ['garden-studio', 'Garden Studio', 34, 1, 2, 'queen', 'garden', 244],
  ['panorama-suite', 'Panorama Suite', 68, 6, 3, 'king', 'sea', 519],
  ['pool-terrace', 'Pool Terrace Room', 45, 1, 2, 'king', 'pool', 386],
  ['family-residence', 'Family Residence', 82, 3, 5, 'twin', 'garden', 574],
  ['skyline-loft', 'Skyline Loft', 58, 7, 2, 'king', 'city', 448],
  ['coastal-twin', 'Coastal Twin', 38, 3, 2, 'twin', 'sea', 305],
  ['asteria-penthouse', 'Asteria Penthouse', 126, 8, 4, 'king', 'sea', 920],
] as const;

export const demoRooms: RoomType[] = roomSeed.map(([slug, name, areaM2, floor, capacity, bedType, view]) => ({
  id: `room_${slug}`,
  hotelId: demoHotel.id,
  slug,
  name,
  description: `${name} with a private outdoor space and considered coastal interiors.`,
  areaM2,
  floor,
  capacity,
  bedType,
  view,
  amenities: ['Wi-Fi', 'Air conditioning', 'Private balcony', 'Rain shower'],
  media: [{ type: 'image', url: '/resort-hero.png' }],
}));

export const demoRates: RatePlan[] = roomSeed.map(([slug, , , , , , , price]) => ({
  id: `rate_${slug}_flex`,
  roomTypeId: `room_${slug}`,
  name: 'Direct Flexible',
  nightlyPrice: price,
  currency: 'EUR',
  breakfastIncluded: true,
  cancellationPolicy: 'Free cancellation up to 72 hours before arrival.',
  otaComparisonPrice: Math.round(price * 1.12),
}));

export const demoAddOns: AddOn[] = [
  { id: 'addon_transfer', name: 'Airport transfer', description: 'Private one-way transfer.', price: 75, currency: 'EUR', pricingUnit: 'per_stay', enabled: true },
  { id: 'addon_spa', name: 'Spa ritual', description: 'A 60-minute treatment.', price: 110, currency: 'EUR', pricingUnit: 'per_guest', enabled: true },
  { id: 'addon_late', name: 'Late check-out', description: 'Keep the room until 18:00.', price: 80, currency: 'EUR', pricingUnit: 'per_stay', enabled: true },
];
