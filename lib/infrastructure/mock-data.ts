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
    // An aerial: the sphere opens looking down at the seafront, and the
    // markers carry real angles onto the buildings and the water below.
    panorama: '/images/panoramas/hotel.webp',
    panoramaView: { yaw: 0, pitch: -22, hfov: 95 },
    panoramaCredit: {
      text: 'Aerial: Alexis Markwick, CC BY-SA 4.0',
      href: 'https://commons.wikimedia.org/wiki/File:East_Parade,_Bexhill_(360_aerial_panorama).jpg',
    },
    // The facade, floor by floor from the roof down. The building's right edge
    // leans in as it descends, so each band is a trapezoid, not a rectangle.
    roomZones: [
      { roomSlug: 'asteria-penthouse', outline: [{ x: 0, y: 0.4 }, { x: 0.56, y: 0.43 }, { x: 0.56, y: 0.5 }, { x: 0, y: 0.56 }] },
      { roomSlug: 'panorama-suite', outline: [{ x: 0, y: 0.56 }, { x: 0.56, y: 0.5 }, { x: 0.55, y: 0.62 }, { x: 0, y: 0.68 }] },
      { roomSlug: 'deluxe-sea', outline: [{ x: 0, y: 0.68 }, { x: 0.55, y: 0.62 }, { x: 0.53, y: 0.75 }, { x: 0, y: 0.81 }] },
      { roomSlug: 'coastal-twin', outline: [{ x: 0, y: 0.81 }, { x: 0.53, y: 0.75 }, { x: 0.5, y: 0.99 }, { x: 0, y: 0.99 }] },
    ],
    hotspots: [
      // Outlines trace the facade photo: the balcony floors, and the roof deck above them.
      { id: 'sea-view', label: 'Sea-view rooms', description: 'Floors three and up face the open cove. Every sea-view room has a full-width balcony and a west-facing sunset.', x: 0.44, y: 0.58, yaw: -36, pitch: -26, roomSlug: 'deluxe-sea', sphereOutline: [{ yaw: -58, pitch: -17 }, { yaw: -21, pitch: -16 }, { yaw: -17, pitch: -39 }, { yaw: -60, pitch: -41 }], href: '/rooms?view=sea', cta: 'See sea-view rooms' },
      { id: 'roof', label: 'Roof terrace', description: 'The top floor is the Asteria Penthouse: a private roof terrace with a plunge pool and an outdoor kitchen.', x: 0.3, y: 0.4, yaw: 24, pitch: -31, roomSlug: 'asteria-penthouse', sphereOutline: [{ yaw: 9, pitch: -21 }, { yaw: 41, pitch: -23 }, { yaw: 43, pitch: -43 }, { yaw: 7, pitch: -42 }], href: '/rooms/asteria-penthouse', cta: 'Open the penthouse' },
      { id: 'cove', label: 'The cove', description: 'A working fishing cove below the hotel, with the beach club and the boat to the islands.', x: 0.78, y: 0.62, yaw: 118, pitch: -16, href: '/rooms', cta: 'Browse every room' },
    ],
  },
  {
    id: 'pool',
    name: 'Pool',
    description: 'A 25-metre saltwater infinity pool on the lower terrace, shaded from midday by the pavilion.',
    photo: { url: '/images/hotel/pool.webp', width: 2000, height: 1334, alt: 'Infinity pool edge meeting the sea, with a shaded pavilion' },
    panorama: '/images/panoramas/pool.webp',
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
    panorama: '/images/panoramas/spa.webp',
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
    panorama: '/images/panoramas/lobby.webp',
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

/**
 * Equirectangular (2:1) stand-in captures, one per room, shown as one more
 * gallery tab beside the photographs. Asteria Cove has not been shot in 360,
 * so rooms of a kind share a panorama; each entry is replaced on its own as
 * the property's real captures arrive. Credits in `public/images/CREDITS.md`.
 */
const panoramaByRoom: Record<string, string> = {
  'deluxe-sea': '/images/panoramas/room.webp',
  'coastal-twin': '/images/panoramas/room.webp',
  'skyline-loft': '/images/panoramas/room.webp',
  'panorama-suite': '/images/panoramas/suite.webp',
  'family-residence': '/images/panoramas/suite.webp',
  'asteria-penthouse': '/images/panoramas/suite.webp',
  'garden-studio': '/images/panoramas/terrace.webp',
  'pool-terrace': '/images/panoramas/pool.webp',
};

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
  media: [
    ...seed.photos.map((photo) => ({
      type: 'image' as const,
      url: `/images/rooms/${seed.slug}/${photo.file}.webp`,
      label: photo.label,
      width: photo.width,
      height: photo.height,
    })),
    ...(panoramaByRoom[seed.slug]
      ? [{ type: '360' as const, url: panoramaByRoom[seed.slug]!, label: '360° view' }]
      : []),
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
  // Services the staff performs. No photograph: nobody picks a transfer by sight.
  {
    id: 'addon_transfer',
    name: 'Airport transfer',
    description: 'Private one-way transfer from Split airport in an electric car, met at arrivals.',
    category: 'service',
    price: 75,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_transfer_return',
    parentId: 'addon_transfer',
    name: 'Return leg on departure',
    description: 'The same car back to Split at the hour your flight needs.',
    category: 'service',
    price: 75,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_transfer_child_seat',
    parentId: 'addon_transfer',
    name: 'Child seat',
    description: 'Fitted and checked before the car leaves.',
    category: 'service',
    price: 10,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_spa',
    name: 'Spa ritual',
    description: 'A 60-minute treatment in the cliffside spa, booked per guest.',
    category: 'service',
    price: 110,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_spa_longer',
    parentId: 'addon_spa',
    name: 'Extend to 90 minutes',
    description: 'Half an hour more on the table, and the sea-facing room.',
    category: 'service',
    price: 45,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_spa_couples',
    parentId: 'addon_spa',
    name: 'Book the couples room',
    description: 'Two therapists, one room, side by side above the water.',
    category: 'service',
    price: 60,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_boat',
    name: 'Boat to the islands',
    description: 'A day on the water: three island stops, swimming off the back, ice and towels aboard.',
    category: 'service',
    price: 140,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_boat_skipper',
    parentId: 'addon_boat',
    name: 'Keep the boat private',
    description: 'Your party only, and the skipper takes the route you ask for.',
    category: 'service',
    price: 90,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_boat_lunch',
    parentId: 'addon_boat',
    name: 'Lunch on board',
    description: 'Grilled fish, bread, and wine served at anchor.',
    category: 'service',
    price: 35,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_bikes',
    name: 'Two bicycles for the day',
    description: 'Kept by the gate with helmets, locks, and a map of the coast road.',
    category: 'service',
    price: 30,
    currency: 'EUR',
    pricingUnit: 'per_night',
    enabled: true,
  },
  {
    id: 'addon_bikes_electric',
    parentId: 'addon_bikes',
    name: 'Make them e-bikes',
    description: 'For the hill back up from the cove.',
    category: 'service',
    price: 20,
    currency: 'EUR',
    pricingUnit: 'per_night',
    enabled: true,
  },
  {
    id: 'addon_late',
    name: 'Late check-out',
    description: 'Keep the room until 18:00 on your departure day.',
    category: 'service',
    price: 80,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_minibar',
    name: 'Minibar restocked daily',
    description: "Local beer, juices, and the kitchen's own snacks replaced every morning.",
    category: 'service',
    price: 25,
    currency: 'EUR',
    pricingUnit: 'per_night',
    enabled: true,
  },
  {
    id: 'addon_laundry',
    name: 'Laundry and pressing',
    description: 'Collected in the morning, back in the wardrobe by six, as often as you need it.',
    category: 'service',
    price: 45,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },

  // The kitchen's list. Each dish carries its photograph, because food is chosen by sight.
  {
    id: 'addon_breakfast_room',
    name: 'Breakfast in the room',
    description:
      'Eggs cooked to order, pastries from the morning bake, fruit, and juice — brought up at the hour you pick instead of the terrace.',
    category: 'dining',
    photos: [
      { url: '/images/dining/breakfast.webp', width: 1600, height: 1200 },
      { url: '/images/dining/breakfast-2.webp', width: 1600, height: 1200 },
      { url: '/images/dining/breakfast-3.webp', width: 1600, height: 1200 },
    ],
    price: 18,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_breakfast_sparkling',
    parentId: 'addon_breakfast_room',
    name: 'Glass of sparkling',
    description: 'Poured cold with the first course.',
    category: 'dining',
    price: 9,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_breakfast_pastries',
    parentId: 'addon_breakfast_room',
    name: 'Extra basket of pastries',
    description: 'Whatever came out of the oven that morning, to keep for later.',
    category: 'dining',
    price: 7,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_terrace_dinner',
    name: 'Dinner on the terrace',
    description:
      "Grilled octopus and the day's whole catch with peppers, new potatoes, and a tomato salad, at your own table above the cove.",
    category: 'dining',
    photos: [
      { url: '/images/dining/terrace-dinner.webp', width: 1600, height: 1200 },
      { url: '/images/dining/terrace-dinner-2.webp', width: 1600, height: 1200 },
      { url: '/images/dining/terrace-dinner-3.webp', width: 1600, height: 1200 },
    ],
    price: 65,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_dinner_wine',
    parentId: 'addon_terrace_dinner',
    name: 'Wine pairing',
    description: 'Three glasses chosen for the courses, all from the islands.',
    category: 'dining',
    price: 28,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
  },
  {
    id: 'addon_dinner_edge',
    parentId: 'addon_terrace_dinner',
    name: 'The table at the cliff edge',
    description: 'The two-top on the lowest step, held for you at sunset.',
    category: 'dining',
    price: 20,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_oysters',
    name: 'Oysters on ice',
    description:
      'A dozen from the Ston beds, opened to order and brought out with lemon, shallot vinegar, and dark bread.',
    category: 'dining',
    photos: [
      { url: '/images/dining/oysters.webp', width: 1600, height: 1200 },
      { url: '/images/dining/oysters-2.webp', width: 1600, height: 1200 },
      { url: '/images/dining/oysters-3.webp', width: 1600, height: 1200 },
    ],
    price: 42,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_oysters_prosecco',
    parentId: 'addon_oysters',
    name: 'Half bottle of prosecco',
    description: 'In the ice bucket alongside.',
    category: 'dining',
    price: 26,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_oysters_double',
    parentId: 'addon_oysters',
    name: 'Make it two dozen',
    description: 'For four people, or for two who are not sharing.',
    category: 'dining',
    price: 38,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_cheese_board',
    name: 'Pršut and island cheese board',
    description:
      "Dry-cured pršut, sheep's cheese from Pag, olives, black fig spread, and warm bread. Enough for two on the balcony.",
    category: 'dining',
    photos: [
      { url: '/images/dining/cheese-board.webp', width: 1600, height: 1200 },
      { url: '/images/dining/cheese-board-2.webp', width: 1600, height: 1200 },
      { url: '/images/dining/cheese-board-3.webp', width: 1600, height: 1200 },
    ],
    price: 32,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_board_double',
    parentId: 'addon_cheese_board',
    name: 'Double the board',
    description: 'Twice of everything, on the larger plank.',
    category: 'dining',
    price: 26,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_figs',
    name: 'Figs, honey, and rakija',
    description:
      'Late-summer figs split over the local honey with a walnut cream, and two small glasses of the house rakija.',
    category: 'dining',
    photos: [
      { url: '/images/dining/figs.webp', width: 1600, height: 1200 },
      { url: '/images/dining/figs-2.webp', width: 1600, height: 1200 },
      { url: '/images/dining/figs-3.webp', width: 1600, height: 1200 },
    ],
    price: 22,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_figs_coffee',
    parentId: 'addon_figs',
    name: 'Turkish coffee for two',
    description: 'Made in the copper pot, served on the balcony.',
    category: 'dining',
    price: 8,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_arrival_wine',
    name: 'Bottle of Pošip on arrival',
    description:
      'The island white, poured cold. Chilled and waiting in the room with two glasses when you check in.',
    category: 'dining',
    photos: [
      { url: '/images/dining/arrival-wine.webp', width: 1600, height: 1200 },
      { url: '/images/dining/arrival-wine-2.webp', width: 1600, height: 1200 },
      { url: '/images/dining/arrival-wine-3.webp', width: 1600, height: 1200 },
    ],
    price: 38,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_wine_magnum',
    parentId: 'addon_arrival_wine',
    name: 'Make it a magnum',
    description: 'Twice the bottle, same ice bucket.',
    category: 'dining',
    price: 34,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
  {
    id: 'addon_wine_fruit',
    parentId: 'addon_arrival_wine',
    name: 'Fruit plate beside it',
    description: 'Whatever the market had that morning, cut and chilled.',
    category: 'dining',
    price: 12,
    currency: 'EUR',
    pricingUnit: 'per_stay',
    enabled: true,
  },
];
