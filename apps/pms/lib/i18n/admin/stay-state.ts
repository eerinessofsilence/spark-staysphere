import type { StayState } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from './dictionaries';

/** The state's name in the team member's language: `t(stayStateKey(state))`. */
export function stayStateKey(state: StayState): AdminTranslationKey {
  switch (state) {
    case 'booked':
      return 'stay.booked';
    case 'checked_in':
      return 'stay.checkedIn';
    case 'checked_out':
      return 'stay.checkedOut';
    case 'no_show':
      return 'stay.noShow';
  }
}

/** What the desk presses to get there — a verb, since a menu item is an action, not a label. */
export function stayMoveKey(from: StayState, to: StayState): AdminTranslationKey {
  switch (to) {
    case 'checked_in':
      return from === 'checked_out' ? 'stay.backToCheckedIn' : 'stay.checkIn';
    case 'checked_out':
      return 'stay.checkOut';
    case 'no_show':
      return 'stay.markNoShow';
    case 'booked':
      return 'stay.backToConfirmed';
  }
}
