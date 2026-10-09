import { addIsoDays } from './dates';
import { MAX_STAY_NIGHTS, type RatePlan } from './schemas';

/** Applied identically during discovery, quoting and final confirmation. */
export function rateAllowsStay(rate: RatePlan, checkIn: string, nights: number): boolean {
  if (!Number.isInteger(nights) || nights < 1 || nights > MAX_STAY_NIGHTS) return false;
  if (nights < (rate.minimumStay ?? 1)) return false;
  if (nights < (rate.minimumStayOnArrival ?? 1)) return false;
  if (nights > (rate.maximumStay ?? MAX_STAY_NIGHTS)) return false;
  if (!rate.closedDates?.length) return true;

  const closed = new Set(rate.closedDates);
  for (let index = 0; index < nights; index += 1) {
    if (closed.has(addIsoDays(checkIn, index))) return false;
  }
  return true;
}
