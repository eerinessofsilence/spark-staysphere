import type { StayState } from './schemas';

/**
 * Where a confirmed stay is on the desk's side, separate from the booking's
 * own commercial status (`Booking.status`): a guest checks in and out of a
 * booking that stays `confirmed` throughout, and a no-show is a confirmed
 * booking nobody arrived for. Every move is undoable one step back, because
 * a desk taps the wrong guest more often than a PMS likes to admit.
 */
export const STAY_TRANSITIONS: Record<StayState, readonly StayState[]> = {
  booked: ['checked_in', 'no_show'],
  checked_in: ['checked_out', 'booked'],
  checked_out: ['checked_in'],
  no_show: ['booked'],
};

export function canTransitionStay(from: StayState, to: StayState): boolean {
  return STAY_TRANSITIONS[from].includes(to);
}
