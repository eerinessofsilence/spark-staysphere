import type { AddOn, Hotel, HotelArea, RatePlan, RoomType, SpinnerHotspot } from '../domain/schemas';
import { trackedOutlines } from './spinner-outlines';

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
      'Eight floors of white balconies curving above the town, the upper ones looking clear over the rooftops to the Mediterranean.',
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
    // The roof itself is left unzoned: what the photo shows there is the open
    // terrace walkway, not a private balcony, so outlining it and naming the
    // penthouse would point guests at the wrong thing.
    roomZones: [
      {
        roomSlug: 'panorama-suite',
        outline: [
          { x: 0, y: 0.56 },
          { x: 0.56, y: 0.5 },
          { x: 0.55, y: 0.62 },
          { x: 0, y: 0.68 },
        ],
      },
      {
        roomSlug: 'deluxe-sea',
        outline: [
          { x: 0, y: 0.68 },
          { x: 0.55, y: 0.62 },
          { x: 0.53, y: 0.75 },
          { x: 0, y: 0.81 },
        ],
      },
      {
        roomSlug: 'coastal-twin',
        outline: [
          { x: 0, y: 0.81 },
          { x: 0.53, y: 0.75 },
          { x: 0.5, y: 0.99 },
          { x: 0, y: 0.99 },
        ],
      },
    ],
    hotspots: [
      // Outlines trace the facade photo: the balcony floors, and the roof deck above them.
      {
        id: 'sea-view',
        label: 'Sea-view rooms',
        description:
          'Floors three and up look over the rooftops to the sea. Every sea-view room has a full-width balcony and a west-facing sunset.',
        x: 0.44,
        y: 0.58,
        yaw: -36,
        pitch: -26,
        roomSlug: 'deluxe-sea',
        sphereOutline: [
          { yaw: -58, pitch: -17 },
          { yaw: -21, pitch: -16 },
          { yaw: -17, pitch: -39 },
          { yaw: -60, pitch: -41 },
        ],
        href: '/rooms?view=sea',
        cta: 'See these rooms',
      },
      {
        id: 'cove',
        label: 'The seafront',
        description:
          'The bay is ten minutes downhill: the marina, the beach clubs and the boat to the islands.',
        x: 0.78,
        y: 0.62,
        yaw: 118,
        pitch: -16,
        href: '/rooms',
        cta: 'Browse every room',
      },
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
      { id: 'treatment', label: 'Treatment rooms', description: 'Two rooms, both with a window onto the garden. Sixty-minute rituals, booked per guest.', x: 0.8, y: 0.34, href: '/rooms?addOn=addon_spa', cta: 'Add a spa ritual' },
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
      { id: 'transfer', label: 'Arrivals', description: 'Private transfers from Larnaca airport arrive at the lobby door, about fifty minutes on a good day.', x: 0.14, y: 0.52, href: '/rooms?addOn=addon_transfer', cta: 'Add an airport transfer' },
    ],
  },
];

const SPIN_FRAME_COUNT = 160;

/**
 * The facade's storeys, sliced out of the one band that was traced rather than
 * traced again. `sea-view` runs from the roof parapet down the front of the
 * building, so every floor is a fixed fraction of it — which means a floor band
 * follows the building through the whole arc for free, and re-tracking the band
 * re-tracks all eight of them at once.
 *
 * The fractions were measured off frame 140. The parapet stands above the roof
 * terrace, so the top slice is the deep one; every storey under it is an even
 * step. Fractions past 1 carry on down the facade below the traced band, which
 * is where the lower floors are.
 */
const SEA_FLOOR_EDGES = [0, 0.415, 0.69, 0.966, 1.242, 1.517, 1.793, 2.068, 2.3];

/**
 * The far side is traced from its roof soffit down four slabs, so its storeys
 * are quarters of the band with nothing to extrapolate. It stops at the fifth
 * floor: below that the trees along the road are in front of the building, and
 * a storey that lights up behind a tree is worse than no storey at all.
 */
const CITY_FLOOR_EDGES = [0, 0.25, 0.5, 0.75, 1];

/** One storey of a facade, as keyframes tracking the band it was cut from. */
function floorBand(band: string, edges: number[], index: number): SpinnerHotspot['keyframes'] {
  const from = edges[index]!;
  const to = edges[index + 1]!;
  return trackedOutlines[band]!.map((keyframe) => {
    const points = keyframe.outline!;
    const half = points.length / 2;
    // The traced band is a strip: the first half runs left to right along its
    // top edge, the second half back along its bottom, so a column's two ends
    // are mirrored about the middle.
    const edgeAt = (depth: number) =>
      points.slice(0, half).map((top, column) => {
        const bottom = points[points.length - 1 - column]!;
        return {
          x: top.x + (bottom.x - top.x) * depth,
          y: top.y + (bottom.y - top.y) * depth,
        };
      });
    const upper = edgeAt(from);
    const lower = edgeAt(to);
    const middle = Math.floor(half / 2);
    return {
      // The card hangs off the middle of the storey, not off a corner of it.
      x: (upper[middle]!.x + lower[middle]!.x) / 2,
      y: (upper[middle]!.y + lower[middle]!.y) / 2,
      frameIndex: keyframe.frameIndex,
      outline: [...upper, ...[...lower].reverse()],
    };
  });
}

interface FloorRoom {
  slug: string;
  name: string;
  blurb: string;
}

/**
 * Top down, one room to a storey. Several rooms share most floors, so each band
 * names the one a guest looking at that side is most likely to be after; the
 * catalog is a click away for the rest. No room appears on both facades — a
 * room faces one way.
 */
const SEA_FLOOR_ROOMS: FloorRoom[] = [
  { slug: 'asteria-penthouse', name: 'Asteria Penthouse', blurb: 'The whole top floor, opening onto the roof terrace and its pool.' },
  { slug: 'signature-suite', name: 'Signature Suite', blurb: 'Seventh floor, with the deepest balcony on the sea side.' },
  { slug: 'panorama-suite', name: 'Panorama Suite', blurb: 'Sixth floor, wrapping the corner for a view along the coast.' },
  { slug: 'terrace-suite', name: 'Terrace Suite', blurb: 'Fifth floor, a full-width terrace above the rooftops.' },
  { slug: 'deluxe-sea', name: 'Deluxe Sea View', blurb: 'Fourth floor, clear over the town to the water.' },
  { slug: 'coastal-twin', name: 'Coastal Twin', blurb: 'Third floor, two beds and a balcony facing the sea.' },
  { slug: 'cove-studio', name: 'Cove Studio', blurb: 'Second floor, a compact studio with the same outlook.' },
  { slug: 'poolside-suite', name: 'Poolside Suite', blurb: 'Ground floor, opening straight onto the pool deck.' },
];

/** The same, for the four storeys the town side shows above its treeline. */
const CITY_FLOOR_ROOMS: FloorRoom[] = [
  { slug: 'sky-terrace-suite', name: 'Sky Terrace Suite', blurb: 'Top floor, its terrace opening onto the roof pool.' },
  { slug: 'skyline-loft', name: 'Skyline Loft', blurb: 'Seventh floor, over the rooftops to the hills behind town.' },
  { slug: 'corner-suite', name: 'Corner Suite', blurb: 'Sixth floor, turning the corner where the two facades meet.' },
  { slug: 'city-view-room', name: 'City View Room', blurb: 'Fifth floor, looking down over the streets of Limassol.' },
];

/** The storeys of one facade, as hotspots that trace rather than pin. */
function floorZones(band: string, edges: number[], rooms: FloorRoom[], topFloor: number) {
  return rooms.map((room, index) => ({
    id: `${band}-floor-${topFloor - index}`,
    label: room.name,
    description: room.blurb,
    roomSlug: room.slug,
    href: `/rooms/${room.slug}`,
    cta: 'See this room',
    zone: true,
    keyframes: floorBand(band, edges, index),
  }));
}

/**
 * A drone orbit of the property, 2.25° a frame, so a drag reads as continuous
 * motion rather than a slideshow. Credited in `public/images/CREDITS.md`.
 * `BuildingSpinner` fetches a window around the current frame, not all 160.
 *
 * The hotspots are the `sea-view` and `cove` markers `hotelAreas`
 * already carries on that facade photo — same copy, same destinations, same
 * `roomSlug` (so pricing still flows through `formatRoomLine`/`rooms`) — just
 * with a keyframe arc instead of one fixed `{x, y}`, since a marker only exists
 * across the frames where the thing it names actually faces the camera.
 *
 * The traced zone outlines come from `scripts/track-outlines.py`: a few frames are
 * traced by hand and a planar tracker carries the shape across the rest of the arc.
 */
const buildingSpinner: NonNullable<Hotel['spinner']> = {
  frameCount: SPIN_FRAME_COUNT,
  // Native capture resolution: the stage draws ~3000 device px wide on a retina
  // screen, so anything downscaled here is upscaled straight back on display.
  frameWidth: 1920,
  frameHeight: 1080,
  /** Front, side, back, side — picked by hand from the full capture, not an
      even quarter-turn: the property's own footprint doesn't sit on a clean
      rectangle, so the four faces that actually front, side and back the
      building land on these frames rather than N/4 apart. */
  keyAngles: [23, 60, 97, 140],
  frames: Array.from({ length: SPIN_FRAME_COUNT }, (_, index) => ({
    index,
    imageUrl: `/images/hotel/spin/frame-${String(index).padStart(3, '0')}.webp`,
  })),
  hotspots: [
    {
      id: 'sea-view',
      label: 'Sea-view rooms',
      description:
        'Floors three and up look over the rooftops to the sea. Every sea-view room has a full-width balcony and a west-facing sunset.',
      roomSlug: 'deluxe-sea',
      href: '/rooms?view=sea',
      cta: 'See sea-view rooms',
      // Marker only, and lifted clear above the parapet. The shape it was
      // traced from is now cut into the storeys below: a second outline over
      // the same balconies would fight them for the hover, and the pill sitting
      // at the band's centre sat squarely on two of the floors it supersedes.
      keyframes: trackedOutlines['sea-view']!.map((keyframe) => {
        const points = keyframe.outline!;
        const roofline = points[Math.floor(points.length / 4)]!;
        return { frameIndex: keyframe.frameIndex, x: roofline.x, y: roofline.y - 0.06 };
      }),
    },
    {
      id: 'cove',
      label: 'The seafront',
      description: 'The bay is ten minutes downhill: the marina, the beach clubs and the boat to the islands.',
      roomSlug: null,
      href: '/rooms',
      cta: 'Browse every room',
      // Kept clear of the area-name pill in the stage's top-left corner.
      keyframes: [
        { frameIndex: 0, x: 0.30, y: 0.13 },
        { frameIndex: 30, x: 0.52, y: 0.11 },
        { frameIndex: 60, x: 0.72, y: 0.12 },
      ],
    },
    {
      id: 'city-view',
      label: 'Town-side rooms',
      description:
        'The far side looks inland over the rooftops to the hills, and it is the quiet one — the road runs along the sea front.',
      roomSlug: 'skyline-loft',
      href: '/rooms?view=city',
      cta: 'See town-side rooms',
      // Marker only, and it outlives its facade's traced storeys on purpose:
      // without it the quarter-turn past the far corner had nothing on it at
      // all, and a stage a guest cannot touch reads as broken rather than plain.
      keyframes: [
        { frameIndex: 34, x: 0.5876, y: 0.29 },
        { frameIndex: 60, x: 0.5194, y: 0.31 },
        { frameIndex: 86, x: 0.4238, y: 0.30 },
        { frameIndex: 100, x: 0.45, y: 0.30 },
        { frameIndex: 112, x: 0.47, y: 0.30 },
      ],
    },
    ...floorZones('sea-view', SEA_FLOOR_EDGES, SEA_FLOOR_ROOMS, 8),
    ...floorZones('city-view', CITY_FLOOR_EDGES, CITY_FLOOR_ROOMS, 8),
  ],
};

export const demoHotel: Hotel = {
  id: 'hotel_asteria',
  slug: 'asteria-cove',
  name: 'Asteria Cove',
  tagline: 'See the stay. Book the room.',
  location: 'Limassol, Cyprus',
  currency: 'EUR',
  timezone: 'Asia/Nicosia',
  areas: hotelAreas,
  spinner: buildingSpinner,
  // The massing behind the facade photo: a tower at the back of the site
  // carrying every floor, two terraced blocks stepping down toward the sea in
  // front of it — each one's roof the terrace of the floor above — the low spa
  // wing to the west, and the pool on the plinth's edge above the cove.
  model: {
    floorHeight: 3.2,
    blocks: [
      {
        id: 'slab',
        x: 0,
        z: 0,
        width: 62,
        depth: 17,
        bow: 6,
        fromFloor: 1,
        toFloor: 8,
        balconies: ['front'],
        glazedFloors: [1],
        roofTerrace: true,
      },
      {
        id: 'corner',
        x: 34,
        z: -7,
        width: 16,
        depth: 15,
        bow: 1.5,
        fromFloor: 1,
        toFloor: 6,
        balconies: ['front'],
        glazedFloors: [1],
        roofTerrace: true,
      },
    ],
    grounds: {
      width: 108,
      depth: 68,
      height: 3,
    },
    view: { azimuth: 24, elevation: 17 },
  },
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
  /**
   * Gallery, in display order. The first photo is the room's cover. `from`
   * borrows a file from another room's folder: the stand-in library is
   * finite, and until the property is shot, a new room type is dressed from
   * it rather than left without a photograph. Each cover is still unique.
   */
  photos: { file: string; label: string; width: number; height: number; from?: string }[];
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
  'sea-view-room': '/images/panoramas/room.webp',
  'cove-studio': '/images/panoramas/room.webp',
  'city-view-room': '/images/panoramas/room.webp',
  'garden-terrace-room': '/images/panoramas/terrace.webp',
  'garden-residence': '/images/panoramas/terrace.webp',
  'poolside-suite': '/images/panoramas/pool.webp',
  'terrace-suite': '/images/panoramas/suite.webp',
  'corner-suite': '/images/panoramas/suite.webp',
  'signature-suite': '/images/panoramas/suite.webp',
  'sky-terrace-suite': '/images/panoramas/suite.webp',
  'family-loft': '/images/panoramas/suite.webp',
  'two-bedroom-residence': '/images/panoramas/suite.webp',
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
      'A corner room on the fourth floor with a full-width balcony facing the sea. Lime-washed walls, oak joinery, and a deep soaking tub set against the window.',
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

  // The rest of the house. Every category the filters offer has more than one
  // room in it, and prices climb in steps a guest can feel rather than jumps.
  {
    slug: 'sea-view-room',
    name: 'Sea View Room',
    areaM2: 36,
    floor: 3,
    capacity: 2,
    bedType: 'queen',
    view: 'sea',
    nightlyPrice: 312,
    description:
      'The plainest way to wake up to the water: a queen bed, a chair by the glass, and the whole cove in the window.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Rain shower', 'Blackout blinds', 'Nespresso bar'],
    photos: [
      { file: 'balcony', label: 'The view', width: 16000, height: 2134, from: 'deluxe-sea' },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'coastal-twin' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 1496, from: 'deluxe-sea' },
    ],
  },
  {
    slug: 'cove-studio',
    name: 'Cove Studio',
    areaM2: 32,
    floor: 2,
    capacity: 2,
    bedType: 'queen',
    view: 'sea',
    nightlyPrice: 289,
    description:
      'A compact room over the fishing cove, with a slim balcony wide enough for two coffees and the morning boats.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Balcony', 'Rain shower', 'Work desk'],
    photos: [
      { file: 'balcony', label: 'Balcony', width: 16000, height: 1387, from: 'coastal-twin' },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'deluxe-sea' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 1496, from: 'coastal-twin' },
    ],
  },
  {
    slug: 'garden-terrace-room',
    name: 'Garden Terrace Room',
    areaM2: 40,
    floor: 1,
    capacity: 2,
    bedType: 'king',
    view: 'garden',
    nightlyPrice: 268,
    description:
      'Ground floor, opening onto its own stretch of the olive garden. Shaded by noon, quiet by design.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Garden terrace',
      'Rain shower',
      'Step-free access',
      'Loungers',
    ],
    photos: [
      {
        file: 'terrace',
        label: 'Garden terrace',
        width: 16000,
        height: 2845,
        from: 'garden-studio',
      },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'garden-studio' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 2400, from: 'garden-studio' },
    ],
  },
  {
    slug: 'city-view-room',
    name: 'City View Room',
    areaM2: 33,
    floor: 5,
    capacity: 2,
    bedType: 'queen',
    view: 'city',
    nightlyPrice: 256,
    description:
      'Faces the old town rather than the water: rooftops, bell towers, and the harbour lights after dark.',
    amenities: ['Wi-Fi', 'Air conditioning', 'Work desk', 'Rain shower', 'Blackout blinds'],
    photos: [
      { file: 'window', label: 'The window', width: 16000, height: 2400, from: 'skyline-loft' },
      { file: 'bedroom', label: 'Bedroom', width: 16000, height: 1065, from: 'skyline-loft' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 2400, from: 'skyline-loft' },
    ],
  },
  {
    slug: 'poolside-suite',
    name: 'Poolside Suite',
    areaM2: 62,
    floor: 1,
    capacity: 3,
    bedType: 'king',
    view: 'pool',
    nightlyPrice: 498,
    description:
      'A bedroom and a sitting room that both open to the pool deck, a few steps from the infinity edge.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Pool access',
      'Outdoor shower',
      'Loungers',
      'Nespresso bar',
    ],
    photos: [
      { file: 'terrace', label: 'Pool deck', width: 16000, height: 1064, from: 'pool-terrace' },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'pool-terrace' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 2400, from: 'pool-terrace' },
    ],
  },
  {
    slug: 'terrace-suite',
    name: 'Terrace Suite',
    areaM2: 74,
    floor: 5,
    capacity: 3,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 585,
    description:
      'The terrace is the room: deep enough for a dining table and two loungers, with the sea from every seat.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Wraparound terrace',
      'Dining table for four',
      'Rain shower',
      'Freestanding tub',
    ],
    photos: [
      { file: 'terrace', label: 'Terrace', width: 1600, height: 1067, from: 'panorama-suite' },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'panorama-suite' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 1496, from: 'panorama-suite' },
    ],
  },
  {
    slug: 'corner-suite',
    name: 'Corner Suite',
    areaM2: 70,
    floor: 6,
    capacity: 2,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 560,
    description:
      'Glass on two sides at the end of the sixth floor, so the sunset arrives in the living room and stays.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Private balcony',
      'Espresso machine',
      'Rain shower',
      'Record player',
    ],
    photos: [
      { file: 'living', label: 'Living room', width: 1600, height: 1067, from: 'panorama-suite' },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'panorama-suite' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 1496, from: 'panorama-suite' },
    ],
  },
  {
    slug: 'family-loft',
    name: 'Family Loft',
    areaM2: 76,
    floor: 7,
    capacity: 4,
    bedType: 'twin',
    view: 'city',
    nightlyPrice: 512,
    description:
      'Two levels under the roof: beds for four upstairs, a long sofa and a table for homework or cards below.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Mezzanine study',
      'Two bathrooms',
      'Kitchenette',
      'Cot on request',
    ],
    photos: [
      { file: 'living', label: 'Living room', width: 1600, height: 1067, from: 'skyline-loft' },
      { file: 'bedroom', label: 'Bedroom', width: 16000, height: 1065, from: 'skyline-loft' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 2400, from: 'skyline-loft' },
    ],
  },
  {
    slug: 'garden-residence',
    name: 'Garden Residence',
    areaM2: 96,
    floor: 2,
    capacity: 6,
    bedType: 'twin',
    view: 'garden',
    nightlyPrice: 640,
    description:
      'Three bedrooms around one living room, with a walled garden of its own. Made for a family that travels together.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Garden terrace',
      'Two bathrooms',
      'Kitchenette',
      'Dining table for four',
      'Cot on request',
    ],
    photos: [
      { file: 'living', label: 'Living room', width: 1600, height: 1067, from: 'family-residence' },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'family-residence' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 2400, from: 'family-residence' },
    ],
  },
  {
    slug: 'two-bedroom-residence',
    name: 'Two-Bedroom Sea Residence',
    areaM2: 104,
    floor: 4,
    capacity: 5,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 715,
    description:
      'A king room and a twin room off a shared living space, both with the balcony running the full width of the sea side.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Private balcony',
      'Two bathrooms',
      'Kitchenette',
      'Freestanding tub',
    ],
    photos: [
      {
        file: 'second-bedroom',
        label: 'Second bedroom',
        width: 16000,
        height: 2400,
        from: 'family-residence',
      },
      { file: 'bedroom', label: 'Main bedroom', width: 1600, height: 1067, from: 'deluxe-sea' },
      { file: 'bathroom', label: 'Bathroom', width: 16000, height: 2400, from: 'family-residence' },
    ],
  },
  {
    slug: 'signature-suite',
    name: 'Signature Suite',
    areaM2: 92,
    floor: 7,
    capacity: 3,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 690,
    description:
      "The seventh floor's largest suite: a proper living room, a dressing room, and a bath set against the window.",
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Private balcony',
      'Freestanding tub',
      'Espresso machine',
      'Private arrival',
    ],
    photos: [
      {
        file: 'living',
        label: 'Living room',
        width: 1600,
        height: 1067,
        from: 'asteria-penthouse',
      },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1200, from: 'asteria-penthouse' },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 1067, from: 'asteria-penthouse' },
    ],
  },
  {
    slug: 'sky-terrace-suite',
    name: 'Sky Terrace Suite',
    areaM2: 88,
    floor: 8,
    capacity: 2,
    bedType: 'king',
    view: 'sea',
    nightlyPrice: 780,
    description:
      'Shares the roof with the penthouse: a private terrace with an outdoor tub, and nothing above but weather.',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'Roof terrace',
      'Freestanding tub',
      'Outdoor shower',
      'Private arrival',
    ],
    photos: [
      {
        file: 'terrace',
        label: 'Roof terrace',
        width: 1600,
        height: 889,
        from: 'asteria-penthouse',
      },
      { file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067, from: 'panorama-suite' },
      { file: 'bathroom', label: 'Bathroom', width: 1600, height: 1067, from: 'asteria-penthouse' },
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
      url: `/images/rooms/${photo.from ?? seed.slug}/${photo.file}.webp`,
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
    description: 'Private one-way transfer from Larnaca airport in an electric car, met at arrivals.',
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
    description: 'The same car back to Larnaca at the hour your flight needs.',
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
