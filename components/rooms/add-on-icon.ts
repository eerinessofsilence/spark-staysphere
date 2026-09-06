import {
  Baby,
  Bicycle,
  BeerBottle,
  CarProfile,
  ClockAfternoon,
  Coffee,
  FlowerLotus,
  ForkKnife,
  Sailboat,
  Sparkle,
  SuitcaseRolling,
  TShirt,
  Waves,
  Wine,
} from '@phosphor-icons/react/dist/ssr';

type IconComponent = typeof Sparkle;

/**
 * A service is recognised by its mark before its name is read. The catalog is
 * seed data with stable names, so the icon is derived from the name the same
 * way `roomCategory` is — a service added later arrives with a mark of its own
 * and no extra field to fill in. Anything unrecognised keeps the generic one.
 */
const addOnIcons: Array<[RegExp, IconComponent]> = [
  [/transfer|airport|chauffeur|driver/i, CarProfile],
  [/spa|massage|treatment|sauna/i, FlowerLotus],
  [/boat|sail|island|skipper/i, Sailboat],
  [/bicycle|bike|cycling/i, Bicycle],
  [/laundry|pressing|ironing/i, TShirt],
  [/check-?out|check-?in|late|early/i, ClockAfternoon],
  [/breakfast|coffee|espresso/i, Coffee],
  [/dinner|lunch|dining|restaurant|table|chef|oyster/i, ForkKnife],
  [/minibar|beer/i, BeerBottle],
  [/bottle|wine|champagne|prosecco/i, Wine],
  [/cot|crib|baby|child/i, Baby],
  [/beach|swim|dive/i, Waves],
  [/luggage|baggage|storage/i, SuitcaseRolling],
];

export function addOnIcon(name: string): IconComponent {
  return addOnIcons.find(([pattern]) => pattern.test(name))?.[1] ?? Sparkle;
}
