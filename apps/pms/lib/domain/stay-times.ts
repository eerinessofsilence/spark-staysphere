/**
 * The hotel day begins and ends at noon. Keeping these values here makes the
 * guest-facing policy and the front-desk tape chart describe the same stay.
 */
export const STANDARD_CHECK_IN_TIME = '12:00';
export const STANDARD_CHECK_OUT_TIME = '12:00';
export const LATE_CHECK_OUT_TIME = '18:00';

/** The proportion of a hotel-local calendar day that has elapsed at `HH:mm`. */
export function dayProgress(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return Math.min(1, Math.max(0, (hours * 60 + minutes) / (24 * 60)));
}

export function isLateCheckOut(time: string): boolean {
  return time > STANDARD_CHECK_OUT_TIME;
}

export function isEarlyCheckIn(time: string): boolean {
  return time < STANDARD_CHECK_IN_TIME;
}
