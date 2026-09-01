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

interface RoomSeed {
  slug: string;
  name: string;
  areaM2: number;
  floor: number;
  capacity: number;
  bedType: RoomType['bedType'];
  view: RoomType['view'];
  nightlyPrice: number;
  description: string;
  amenities: string[];
  /** Rooms with a scanned interior get the 360° badge; a subset also ships a GLB. */
  has360: boolean;
  has3d: boolean;
}

const roomSeed: RoomSeed[] = [
  {
    slug: 'deluxe-sea',
    name: 'Deluxe Sea View',
    areaM2: 42,
    floor: 4,
    capacity: 2,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 348,
    description:
      'A corner room on the fourth floor with a full-width balcony over the cove. Lime-washed walls, oak joinery, and a deep soaking tub set against the water.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Private balcony', 'Rain shower', 'Nespresso bar', 'Blackout blinds'],
    has360: true,
    has3d: true,
  },
  {
    slug: 'garden-studio',
    name: 'Garden Studio',
    areaM2: 34,
    floor: 1,
    capacity: 2,
    bedType: 'queen',
    view: 'garden',
    nightlyPrice: 244,
    description:
      'Ground-floor studio opening straight onto the olive terrace. Quiet, shaded, and the easiest way into the property for guests who would rather skip the lift.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Garden terrace', 'Rain shower', 'Step-free access'],
    has360: true,
    has3d: false,
  },
  {
    slug: 'panorama-suite',
    name: 'Panorama Suite',
    areaM2: 68,
    floor: 6,
    capacity: 3,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 519,
    description:
      'A separate living room and bedroom behind a nine-metre glass front. The terrace catches the sunset the whole way down the coast.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Wraparound terrace', 'Rain shower', 'Freestanding tub', 'Dining table for four'],
    has360: true,
    has3d: true,
  },
  {
    slug: 'pool-terrace',
    name: 'Pool Terrace Room',
    areaM2: 45,
    floor: 1,
    capacity: 2,
    bedType: 'king',
    view: 'pool',
    nightlyPrice: 386,
    description:
      'Direct access to the quiet end of the main pool through a private gate. Outdoor shower, two loungers, and shade from late morning onward.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Pool access', 'Outdoor shower', 'Rain shower', 'Loungers'],
    has360: true,
    has3d: false,
  },
  {
    slug: 'family-residence',
    name: 'Family Residence',
    areaM2: 82,
    floor: 3,
    capacity: 5,
    bedType: 'twin',
    view: 'garden',
    nightlyPrice: 574,
    description:
      'Two bedrooms, two bathrooms, and a kitchenette around a shared living space. Connecting layout keeps everyone on one key without sharing a wall.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Two bathrooms', 'Kitchenette', 'Balcony', 'Cot on request'],
    has360: true,
    has3d: true,
  },
  {
    slug: 'skyline-loft',
    name: 'Skyline Loft',
    areaM2: 58,
    floor: 7,
    capacity: 2,
    bedType: 'king',
    view: 'city',
    nightlyPrice: 448,
    description:
      'Top-floor loft with a double-height ceiling and a mezzanine study looking back over the old town roofline.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Mezzanine study', 'Rain shower', 'Record player', 'Espresso machine'],
    has360: true,
    has3d: false,
  },
  {
    slug: 'coastal-twin',
    name: 'Coastal Twin',
    areaM2: 38,
    floor: 3,
    capacity: 2,
    bedType: 'twin',
    view: 'sea',
    nightlyPrice: 305,
    description:
      'Two full-size single beds and a slim balcony facing the water. The most straightforward sea-view room in the house.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Private balcony', 'Rain shower', 'Work desk'],
    has360: true,
    has3d: false,
  },
  {
    slug: 'asteria-penthouse',
    name: 'Asteria Penthouse',
    areaM2: 126,
    floor: 8,
    capacity: 4,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 920,
    description:
      'The whole eighth floor: two bedrooms, a roof terrace with a plunge pool, and an outdoor kitchen. Arrival is handled privately.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Roof terrace', 'Plunge pool', 'Outdoor kitchen', 'Private arrival', 'Freestanding tub'],
    has360: true,
    has3d: true,
  },
];

export const demoRooms: RoomType[] = roomSeed.map((seed) => ({
  id: `room_${seed.slug}`,
  hotelId: demoHotel.id,
  slug: seed.slug,
  name: seed.name,
  description: seed.description,
  areaM2: seed.areaM2,
  floor: seed.floor,
  capacity: seed.capacity,
  bedType: seed.bedType,
  view: seed.view,
  amenities: seed.amenities,
  media: [
    { type: 'image' as const, url: `/scenes/${seed.slug}.svg` },
    ...(seed.has360 ? [{ type: '360' as const, url: `/scenes/${seed.slug}-360` }] : []),
    ...(seed.has3d ? [{ type: 'gltf' as const, url: `/scenes/${seed.slug}.glb` }] : []),
  ],
}));

export const demoRates: RatePlan[] = roomSeed.map((seed) => ({
  id: `rate_${seed.slug}_flex`,
  roomTypeId: `room_${seed.slug}`,
  name: 'Direct Flexible',
  nightlyPrice: seed.nightlyPrice,
  currency: 'EUR',
  breakfastIncluded: true,
  includedServices: [
    'Breakfast for all guests',
    'Wi-Fi throughout the property',
    'Beach club chairs and towels',
    'Best direct rate guarantee',
  ],
  cancellationPolicy: 'Free cancellation up to 72 hours before arrival.',
  otaComparisonPrice: Math.round(seed.nightlyPrice * 1.12),
}));

export const demoAddOns: AddOn[] = [
  {
    id: 'addon_transfer',
    name: 'Airport transfer',
    description: 'Private one-way transfer from Split airport in an electric car.',
    price: 75,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_spa',
    name: 'Spa ritual',
    description: 'A 60-minute treatment in the cliffside spa, booked per guest.',
    price: 110,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_late',
    name: 'Late check-out',
    description: 'Keep the room until 18:00 on your departure day.',
    price: 80,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
];
