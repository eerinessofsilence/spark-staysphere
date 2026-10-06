import * as React from 'react';
import {
  AirplaneTilt,
  Baby,
  Barbell,
  Bell,
  Bicycle,
  Books,
  Car,
  Clock,
  Coffee,
  Dog,
  Elevator,
  FirstAid,
  FlowerLotus,
  ForkKnife,
  GameController,
  Golf,
  Lock,
  MusicNotes,
  Plug,
  Presentation,
  Sailboat,
  Shield,
  Snowflake,
  Sun,
  SwimmingPool,
  Taxi,
  Television,
  TennisBall,
  Towel,
  Tree,
  Umbrella,
  Wheelchair,
  WifiHigh,
  Wine,
} from '@phosphor-icons/react/dist/ssr';
import type { FacilityIcon } from '@/lib/domain/schemas';

type IconComponent = React.ComponentType<React.ComponentProps<typeof Sun>>;

// Same reason as `feature-icon.ts`'s WifiMark: filled, Phosphor's Wi-Fi is a solid wedge.
const WifiMark: IconComponent = (props) => React.createElement(WifiHigh, { ...props, weight: 'bold' });

/**
 * Every key `facilityIconSchema` allows, with the glyph it draws and the
 * label the picker shows for it. The order here is the picker's order:
 * water and food first, the desk's services, then the rest.
 */
export const facilityIcons: Record<FacilityIcon, { icon: IconComponent; label: string }> = {
  pool: { icon: SwimmingPool, label: 'Pool' },
  spa: { icon: FlowerLotus, label: 'Spa' },
  gym: { icon: Barbell, label: 'Gym' },
  restaurant: { icon: ForkKnife, label: 'Restaurant' },
  bar: { icon: Wine, label: 'Bar' },
  coffee: { icon: Coffee, label: 'Café' },
  wifi: { icon: WifiMark, label: 'Wi-Fi' },
  parking: { icon: Car, label: 'Parking' },
  'ev-charging': { icon: Plug, label: 'EV charging' },
  shuttle: { icon: AirplaneTilt, label: 'Airport shuttle' },
  taxi: { icon: Taxi, label: 'Taxi' },
  beach: { icon: Umbrella, label: 'Beach' },
  marina: { icon: Sailboat, label: 'Marina' },
  garden: { icon: Tree, label: 'Garden' },
  terrace: { icon: Sun, label: 'Terrace' },
  concierge: { icon: Bell, label: 'Concierge' },
  reception: { icon: Clock, label: '24-hour reception' },
  laundry: { icon: Towel, label: 'Laundry' },
  kids: { icon: Baby, label: 'Kids' },
  pets: { icon: Dog, label: 'Pets' },
  accessible: { icon: Wheelchair, label: 'Accessible' },
  elevator: { icon: Elevator, label: 'Lift' },
  'air-conditioning': { icon: Snowflake, label: 'Air conditioning' },
  safe: { icon: Lock, label: 'Safe' },
  security: { icon: Shield, label: 'Security' },
  business: { icon: Presentation, label: 'Meeting rooms' },
  library: { icon: Books, label: 'Library' },
  games: { icon: GameController, label: 'Games' },
  cinema: { icon: Television, label: 'Cinema' },
  music: { icon: MusicNotes, label: 'Live music' },
  bicycles: { icon: Bicycle, label: 'Bicycles' },
  tennis: { icon: TennisBall, label: 'Tennis' },
  golf: { icon: Golf, label: 'Golf' },
  'first-aid': { icon: FirstAid, label: 'First aid' },
};

export const facilityIconKeys = Object.keys(facilityIcons) as FacilityIcon[];

export function facilityIcon(key: FacilityIcon): IconComponent {
  return facilityIcons[key].icon;
}
