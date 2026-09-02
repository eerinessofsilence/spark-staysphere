import type { AddOn, Hotel, HotelArea, RatePlan, RoomType } from '../domain/schemas';

/**
 * Photography lives in public/images and is credited in public/images/CREDITS.md.
 * Dimensions are recorded so hotspots can be placed through the same cover-crop
 * maths the browser applies.
 */
const hotelAreas: HotelArea[] = [
  {
    id: 'hotel',
    name: 'The hotel',
    description:
      'Eight floors of white balconies stepping down the cliff, every one of them facing the open Adriatic.',
    photo: { url: '/images/hotel/facade.webp', width: 2000, height: 1334, alt: 'Terraced white hotel balconies above a deep blue sea' },
    hotspots: [
      { id: 'sea-view', label: 'Sea-view rooms', description: 'Floors three and up face the open cove. Every sea-view room has a full-width balcony and a west-facing sunset.', x: 0.44, y: 0.58, href: '/rooms?view=sea', cta: 'See sea-view rooms' },
      { id: 'roof', label: 'Roof terrace', description: 'The top floor is the Asteria Penthouse: a private roof terrace with a plunge pool and an outdoor kitchen.', x: 0.3, y: 0.4, href: '/rooms/asteria-penthouse', cta: 'Open the penthouse' },
      { id: 'cove', label: 'The cove', description: 'A working fishing cove below the hotel, with the beach club and the boat to the islands.', x: 0.78, y: 0.62, href: '/rooms', cta: 'Browse every room' },
    ],
  },
  {
    id: 'pool',
    name: 'Pool',
    description: 'A 25-metre saltwater infinity pool on the lower terrace, shaded from midday by the pavilion.',
    photo: { url: '/images/hotel/pool.webp', width: 2000, height: 1334, alt: 'Infinity pool edge meeting the sea, with a shaded pavilion' },
    hotspots: [
      { id: 'infinity', label: 'Infinity edge', description: 'The pool runs to the cliff edge and reads as one surface with the sea.', x: 0.42, y: 0.62, href: '/rooms?view=pool', cta: 'See pool-access rooms' },
      { id: 'pavilion', label: 'Pool bar', description: 'Lunch and long afternoons under the pavilion. Room charge, no cards.', x: 0.74, y: 0.36, href: '/rooms?addOn=addon_late', cta: 'Add a late check-out' },
    ],
  },
  {
    id: 'spa',
    name: 'Spa',
    description: 'The cliffside spa: a stone hydro pool, two treatment rooms, a hammam, and a cold plunge cut into the rock.',
    photo: { url: '/images/hotel/spa.webp', width: 2000, height: 1334, alt: 'Indoor stone spa pool with soft daylight' },
    hotspots: [
      { id: 'hydro', label: 'Hydro pool', description: 'Sea-water pool kept at 34°, with loungers along the stone wall.', x: 0.5, y: 0.66, href: '/rooms?addOn=addon_spa', cta: 'Add a spa ritual' },
      { id: 'treatment', label: 'Treatment rooms', description: 'Two rooms, both with a window onto the cove. Sixty-minute rituals, booked per guest.', x: 0.8, y: 0.34, href: '/rooms?addOn=addon_spa', cta: 'Add a spa ritual' },
    ],
  },
  {
    id: 'lobby',
    name: 'Lobby',
    description: 'Arrival at the glazed base of the tower: reception, the library bar, and the path down to the beach club.',
    photo: { url: '/images/hotel/lobby.webp', width: 2000, height: 1126, alt: 'Marble reception desk with warm timber panelling and plants' },
    hotspots: [
      { id: 'reception', label: 'Reception', description: 'Check-in from 15:00, check-out by 11:00 — or 18:00 with the late check-out.', x: 0.5, y: 0.6, href: '/rooms?addOn=addon_late', cta: 'Add a late check-out' },
      { id: 'transfer', label: 'Arrivals', description: 'Private transfers from Split airport arrive at the lobby door, about fifty minutes on a good day.', x: 0.14, y: 0.52, href: '/rooms?addOn=addon_transfer', cta: 'Add an airport transfer' },
    ],
  },
];

export const demoHotel: Hotel = {
  id: 'hotel_asteria',
  slug: 'asteria-cove',
  name: 'Asteria Cove',
  tagline: 'See the stay. Book the room.',
  location: 'Dalmatian Coast, Croatia',
  currency: 'EUR',
  timezone: 'Europe/Zagreb',
  areas: hotelAreas,
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
  /** Gallery, in display order. The first photo is the room's cover. */
  photos: { file: string; label: string; width: number; height: number }[];
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
    photos: [
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067 },
      { file: 'balcony', label: 'Balcony', width: 1600, height: 2134 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 1496 },
    ],
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
    photos: [
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067 },
      { file: 'terrace', label: 'Terrace', width: 1600, height: 2845 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 2400 },
    ],
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
    photos: [
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067 },
      { file: 'living', label: 'Living room', width: 1600, height: 1067 },
      { file: 'terrace', label: 'Terrace', width: 1600, height: 1067 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 1496 },
    ],
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
    photos: [
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067 },
      { file: 'terrace', label: 'Pool terrace', width: 1600, height: 1064 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 2400 },
    ],
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
    photos: [
      { file: 'bedroom', label: 'Main bedroom', width: 1600, height: 1067 },
      { file: 'living', label: 'Living room', width: 1600, height: 1067 },
      { file: 'second-bedroom', label: 'Second bedroom', width: 1600, height: 2400 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 2400 },
    ],
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
    photos: [
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1065 },
      { file: 'living', label: 'Mezzanine', width: 1600, height: 1067 },
      { file: 'window', label: 'The view', width: 1600, height: 2400 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 2400 },
    ],
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
    photos: [
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067 },
      { file: 'balcony', label: 'Balcony', width: 1600, height: 1387 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 1496 },
    ],
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
    photos: [
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1200 },
      { file: 'terrace', label: 'Roof terrace', width: 1600, height: 889 },
      { file: 'living', label: 'Living room', width: 1600, height: 1067 },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 1067 },
    ],
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
  media: seed.photos.map((photo) => ({
    type: 'image' as const,
    url: `/images/rooms/${seed.slug}/${photo.file}.webp`,
    label: photo.label,
    width: photo.width,
    height: photo.height,
  })),
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
