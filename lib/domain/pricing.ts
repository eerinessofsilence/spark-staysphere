import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { AddOn, AddOnLine, PriceBreakdown, RatePlan } from './schemas';

/** Demo tourist tax. A production build reads this from the PMS rate configuration. */
export const CITY_TAX_PER_ADULT_PER_NIGHT = 2.5;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Nights in a stay. Always at least one so a same-day range never prices at zero. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const nights = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
  return Number.isFinite(nights) && nights > 0 ? nights : 1;
}

export function addOnQuantity(addOn: AddOn, nights: number, guests: number): number {
  switch (addOn.pricingUnit) {
    case 'per_night':
      return nights;
    case 'per_guest':
      return Math.max(1, guests);
    case 'per_stay':
      return 1;
  }
}

export function toAddOnLine(addOn: AddOn, nights: number, guests: number): AddOnLine {
  const quantity = addOnQuantity(addOn, nights, guests);
  return {
    addOnId: addOn.id,
    name: addOn.name,
    pricingUnit: addOn.pricingUnit,
    unitPrice: addOn.price,
    quantity,
    total: roundMoney(addOn.price * quantity),
  };
}

export interface PriceBreakdownInput {
  ratePlan: RatePlan;
  addOns: AddOn[];
  nights: number;
  adults: number;
  children: number;
}

/**
 * The single money rule in the product. The catalog, the room detail summary,
 * the booking review step, and the booking engine quote all route through here
 * so a guest never sees two different totals for the same stay.
 */
export function buildPriceBreakdown({
  ratePlan,
  addOns,
  nights,
  adults,
  children,
}: PriceBreakdownInput): PriceBreakdown {
  const guests = adults + children;
  const roomTotal = roundMoney(ratePlan.nightlyPrice * nights);
  const addOnLines = addOns
    .filter((addOn) => addOn.enabled)
    .map((addOn) => toAddOnLine(addOn, nights, guests));
  const addOnsTotal = roundMoney(addOnLines.reduce((sum, line) => sum + line.total, 0));
  const taxesAndFees = roundMoney(CITY_TAX_PER_ADULT_PER_NIGHT * adults * nights);
  const total = roundMoney(roomTotal + addOnsTotal + taxesAndFees);

  const otaComparisonTotal = ratePlan.otaComparisonPrice
    ? roundMoney(ratePlan.otaComparisonPrice * nights + addOnsTotal + taxesAndFees)
    : null;
  const directSaving = otaComparisonTotal ? Math.max(0, roundMoney(otaComparisonTotal - total)) : 0;

  return {
    nights,
    nightlyPrice: ratePlan.nightlyPrice,
    roomTotal,
    addOnLines,
    addOnsTotal,
    taxesAndFees,
    total,
    currency: ratePlan.currency,
    otaComparisonTotal,
    directSaving,
  };
}
