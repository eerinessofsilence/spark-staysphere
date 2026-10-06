import * as React from 'react';
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

type IconComponent = React.ComponentType<React.ComponentProps<typeof Eye>>;

/**
 * Wi-Fi is its arcs and the air between them. Filled — the weight every other
 * amenity mark is drawn at — Phosphor's collapses into one solid wedge that
 * reads as a cone, a slice, anything but a signal. So this mark keeps its own
 * weight whatever a caller asks for, which is why it is wrapped rather than
 * listed straight in the table below.
 */
const WifiMark: IconComponent = (props) =>
  React.createElement(WifiHigh, { ...props, weight: 'bold' });

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
  [/wi-?fi|internet/i, WifiMark],
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
  // Not a room feature but a promise about the price, and the clay tint is
  // the accent's own: rule 6 gives savings to the accent.
  [/rate guarantee|best rate|best direct|price match/i, 'clay'],
  // Kitchen first, for the same reason the icons order it first: an outdoor
  // kitchen belongs to the kitchen, not to the garden. Breakfast is the
  // kitchen too — the icon table already draws it with a fork.
  [/breakfast|kitchen|dining|table for|espresso|nespresso|coffee|minibar|dinner|lunch|oyster|cheese|prosecco|wine|magnum|figs|bottle|pastr/i, 'clay'],
  // The spa is water too: its ritual sits with the pool and the tub.
  [/pool|shower|tub|bath|toilet|spa|ritual|treatment/i, 'stone'],
  // The boat and the bicycles are the outdoors as much as a terrace is.
  [/terrace|balcony|garden|outdoor|view|panorama|boat|island|bicycle|e-bike|beach/i, 'sage'],
  // The desk's kit, and the desk's errands — a transfer, the laundry, a later
  // check-out — read as the same category of comfort.
  [/wi-?fi|internet|air con|climate|heating|record|blackout|blind|desk|study|work|transfer|airport|child seat|laundry|pressing|check-out/i, 'sand'],
  [/bed|cot|crib|baby|lounger|armchair|sofa|living|couples room/i, 'rose'],
];

export function amenityTone(name: string): AmenityTone {
  return amenityTones.find(([pattern]) => pattern.test(name))?.[1] ?? 'stone';
}

/**
 * Tailwind needs the class names whole, so every tone is spelled out here
 * rather than built from the tone key at runtime.
 *
 * A tone's surface and its mark are kept apart rather than as one string: the
 * label sitting on the tint stays `text-foreground`. The fill and the icon
 * carry the colour; the words stay as readable as the rest of the page.
 */
export const tintSurface: Record<AmenityTone, string> = {
  clay: 'bg-tint-clay',
  sand: 'bg-tint-sand',
  sage: 'bg-tint-sage',
  rose: 'bg-tint-rose',
  stone: 'bg-tint-stone',
};

export const tintInk: Record<AmenityTone, string> = {
  clay: 'text-tint-clay-ink',
  sand: 'text-tint-sand-ink',
  sage: 'text-tint-sage-ink',
  rose: 'text-tint-rose-ink',
  stone: 'text-tint-stone-ink',
};

/**
 * A room's headline facts are a fixed set, so each kind keeps one tone
 * wherever it shows up — a catalog card, the room page, the arrival scene's
 * marker card. The tone belongs to the kind of fact, not to its value: "Sea
 * view" and "Garden view" are both the view chip and both sage, so the same
 * fact is the same colour in every card of a grid.
 *
 * Where a fact and an amenity mean the same thing they agree with the table
 * above — the bed is rose either way, anything about the outdoors is sage.
 */
export const factTone = {
  area: 'stone',
  bed: 'rose',
  capacity: 'clay',
  floor: 'sand',
  view: 'sage',
} as const satisfies Record<string, AmenityTone>;
