import {
  Armchair,
  CalendarCheck,
  Baby,
  Bathtub,
  Bed,
  Coffee,
  CookingPot,
  Desk,
  Eye,
  ForkKnife,
  Key,
  SealPercent,
  Moon,
  Mountains,
  Shower,
  Snowflake,
  Stairs,
  SwimmingPool,
  Toilet,
  Towel,
  Tree,
  VinylRecord,
  Wheelchair,
  WifiHigh,
} from '@phosphor-icons/react/dist/ssr';

type IconComponent = typeof Eye;

/**
 * A list where every line carries the same green check tells the guest only
 * that the list is a list. The mark should say what the thing is, so it is
 * derived from the name — the same way `addOnIcon` does it, and for the same
 * reason: the catalog is seed data with stable names, so new inventory
 * arrives with a mark of its own and no extra field to fill in.
 *
 * Serves both the room's amenities and what a rate plan includes; the two
 * vocabularies overlap (Wi-Fi is Wi-Fi either way).
 *
 * Order matters. The narrower rule wins, so "Outdoor shower" is a shower
 * before "outdoor" can claim it for the garden, "Pool terrace" is a pool
 * before "terrace" takes it, and breakfast is a plate before the coffee rule
 * can hand it a cup.
 */
const featureIcons: Array<[RegExp, IconComponent]> = [
  [/wi-?fi|internet/i, WifiHigh],
  [/air con|climate|heating/i, Snowflake],
  [/breakfast/i, ForkKnife],
  [/towel|beach/i, Towel],
  [/rate guarantee|best rate|best direct|price match/i, SealPercent],
  [/cancellation|cancel/i, CalendarCheck],
  [/tub|bath(?!room)/i, Bathtub],
  [/shower/i, Shower],
  [/bathroom|toilet/i, Toilet],
  [/pool/i, SwimmingPool],
  [/espresso|nespresso|coffee/i, Coffee],
  // Before the outdoor rule: an outdoor kitchen is a kitchen first.
  [/kitchen/i, CookingPot],
  [/terrace|balcony|garden|outdoor/i, Tree],
  [/private arrival|entrance|own key/i, Key],
  [/dining|table for/i, ForkKnife],
  [/desk|study|work/i, Desk],
  [/record player|turntable/i, VinylRecord],
  [/blackout|blind|curtain/i, Moon],
  [/cot|crib|baby/i, Baby],
  [/bedroom|bed\b/i, Bed],
  [/lounger|armchair|sofa|living/i, Armchair],
  [/step-free|accessible|wheelchair/i, Wheelchair],
  [/mezzanine|stair/i, Stairs],
  [/view|panorama/i, Mountains],
];

/** Falls back to the eye: whatever it is, it is something the stay offers to notice. */
export function featureIcon(name: string): IconComponent {
  return featureIcons.find(([pattern]) => pattern.test(name))?.[1] ?? Eye;
}

/** The flat tints an amenity card can wear. Surfaces only, never text colour. */
export type AmenityTone = 'clay' | 'sand' | 'sage' | 'rose' | 'stone';

/**
 * Colour carries the same meaning the mark does — water is one tone, the
 * outdoors another — so a wall of cards groups itself at a glance instead of
 * looking like a randomly coloured template. Anything unclassified stays
 * stone, which is the page's own neutral.
 */
const amenityTones: Array<[RegExp, AmenityTone]> = [
  // Kitchen first, for the same reason the icons order it first: an outdoor
  // kitchen belongs to the kitchen, not to the garden.
  [/kitchen|dining|table for|espresso|nespresso|coffee|minibar/i, 'clay'],
  [/pool|shower|tub|bath|toilet/i, 'stone'],
  [/terrace|balcony|garden|outdoor|view|panorama/i, 'sage'],
  [/wi-?fi|internet|air con|climate|heating|record|blackout|blind|desk|study|work/i, 'sand'],
  [/bed|cot|crib|baby|lounger|armchair|sofa|living/i, 'rose'],
];

export function amenityTone(name: string): AmenityTone {
  return amenityTones.find(([pattern]) => pattern.test(name))?.[1] ?? 'stone';
}
