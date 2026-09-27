import { nightsBetween } from '../domain/pricing';
import type { AddOn, Booking, RatePlan, RoomStatus } from '../domain/schemas';
import type { FrontDesk } from './inventory-service';

/**
 * The dashboard's operational figures, derived from the same bookings and
 * front-desk board the rest of the back office reads. Pure functions over
 * already-priced bookings: `total` came out of `buildPriceBreakdown` when the
 * stay was made, so apportioning it over nights here is analytics, not pricing.
 */

function isLive(booking: Booking): boolean {
  return booking.status === 'confirmed' && booking.stayState !== 'no_show';
}

/** Confirmed and in the building on `day`: the stay covers the night, and nobody has checked out early. */
export function inHouseOn(bookings: Booking[], day: string): Booking[] {
  return bookings.filter(
    (booking) => isLive(booking) && booking.stayState !== 'checked_out' && booking.checkIn <= day && day < booking.checkOut,
  );
}

export type ReservationBucket = 'upcoming' | 'dueIn' | 'inHouse' | 'dueOut' | 'completed' | 'other';

/**
 * Every booking in exactly one operational bucket, as the desk thinks of them:
 * where a stay stands today, not which lifecycle status it carries. Cancelled,
 * no-show and unfinished checkouts fold into `other` so the mix stays six wide.
 */
export function reservationBuckets(bookings: Booking[], today: string): Record<ReservationBucket, number> {
  const buckets: Record<ReservationBucket, number> = { upcoming: 0, dueIn: 0, inHouse: 0, dueOut: 0, completed: 0, other: 0 };
  for (const booking of bookings) {
    if (!isLive(booking)) buckets.other += 1;
    else if (booking.stayState === 'checked_out' || booking.checkOut < today) buckets.completed += 1;
    else if (booking.checkOut === today) buckets.dueOut += 1;
    else if (booking.checkIn === today) buckets.dueIn += 1;
    else if (booking.checkIn < today) buckets.inHouse += 1;
    else buckets.upcoming += 1;
  }
  return buckets;
}

export interface TodayMovements {
  arrivals: Booking[];
  departures: Booking[];
  inHouse: Booking[];
  adults: number;
  children: number;
}

/** Who arrives, who leaves, and who sleeps here tonight — plus how many heads that is. */
export function todayMovements(bookings: Booking[], today: string): TodayMovements {
  const live = bookings.filter(isLive);
  const inHouse = inHouseOn(bookings, today);
  return {
    arrivals: live.filter((booking) => booking.checkIn === today),
    departures: live.filter((booking) => booking.checkOut === today && booking.stayState !== 'checked_out'),
    inHouse,
    adults: inHouse.reduce((sum, booking) => sum + booking.adults, 0),
    children: inHouse.reduce((sum, booking) => sum + booking.children, 0),
  };
}

/** The soonest arrivals after `today`, so an empty day still shows who is next through the door. */
export function nextArrivals(bookings: Booking[], today: string, limit: number): Booking[] {
  return bookings
    .filter((booking) => isLive(booking) && booking.stayState === 'booked' && booking.checkIn > today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.guest.lastName.localeCompare(b.guest.lastName))
    .slice(0, limit);
}

/** The soonest departures after `today` among the stays still in the building. */
export function nextDepartures(bookings: Booking[], today: string, limit: number): Booking[] {
  return inHouseOn(bookings, today)
    .filter((booking) => booking.checkOut > today)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut) || a.guest.lastName.localeCompare(b.guest.lastName))
    .slice(0, limit);
}

export interface RoomTypeAvailability {
  roomTypeId: string;
  name: string;
  total: number;
  sold: number;
  available: number;
  status: RoomStatus;
}

/** Tonight, per room type: how many physical rooms it has, how many are taken, and any sale override on it. */
export function roomTypeAvailability(board: FrontDesk, overrides: Map<string, RoomStatus | null>): RoomTypeAvailability[] {
  return board.groups
    .filter((group) => !group.hidden)
    .map((group) => {
      const sold = group.rooms.filter((room) =>
        room.segments.some((segment) => segment.kind !== 'closed' && segment.start <= 0 && 0 < segment.start + segment.span),
      ).length;
      return {
        roomTypeId: group.roomTypeId,
        name: group.roomName,
        total: group.rooms.length,
        sold,
        available: group.rooms.length - sold,
        status: overrides.get(group.roomTypeId) ?? 'available',
      };
    });
}

export interface MealsDay {
  date: string;
  /** Guests whose rate includes breakfast, sleeping here the night before. */
  breakfast: number;
  /** Dining add-ons booked by the guests in house that day. */
  dining: number;
}

/** Breakfast covers and dining add-ons for each day, from the stays in house on it. */
export function mealsByDay(bookings: Booking[], ratePlans: RatePlan[], addOns: AddOn[], dates: string[]): MealsDay[] {
  const breakfastPlans = new Set(ratePlans.filter((plan) => plan.breakfastIncluded).map((plan) => plan.id));
  const dining = new Set(addOns.filter((addOn) => addOn.category === 'dining').map((addOn) => addOn.id));
  return dates.map((date) => {
    const inHouse = inHouseOn(bookings, date);
    return {
      date,
      breakfast: inHouse
        .filter((booking) => breakfastPlans.has(booking.ratePlanId))
        .reduce((sum, booking) => sum + booking.adults + booking.children, 0),
      dining: inHouse.reduce((sum, booking) => sum + booking.addOnIds.filter((id) => dining.has(id)).length, 0),
    };
  });
}

export interface RevenueKpis {
  /** The night's share of every stay in house, each stay's total spread evenly over its nights. */
  roomRevenue: number;
  occupiedRooms: number;
  /** Room revenue per available room — over the whole building, empty rooms included. */
  revpar: number;
  /** Average daily rate — room revenue per occupied room. */
  adr: number;
  /** Stays confirmed (booked) on that day. */
  orders: number;
}

export function revenueKpis(bookings: Booking[], totalRooms: number, day: string): RevenueKpis {
  const inHouse = inHouseOn(bookings, day);
  const roomRevenue = inHouse.reduce(
    (sum, booking) => sum + booking.total / Math.max(1, nightsBetween(booking.checkIn, booking.checkOut)),
    0,
  );
  return {
    roomRevenue,
    occupiedRooms: inHouse.length,
    revpar: totalRooms > 0 ? roomRevenue / totalRooms : 0,
    adr: inHouse.length > 0 ? roomRevenue / inHouse.length : 0,
    orders: bookings.filter((booking) => booking.status === 'confirmed' && booking.createdAt.slice(0, 10) === day).length,
  };
}
