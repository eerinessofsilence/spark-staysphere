import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';

/**
 * The first-run tour, in the order a team member meets the back office.
 *
 * A step points at whatever carries `data-tour="<target>"`; a target that
 * isn't on screen right now is simply skipped, which is what makes one list
 * work for both layouts — the sidebar's own steps drop out on a phone, where
 * that whole column lives behind the menu button, and the menu step drops
 * out on a desktop, where there is no such button. Nothing here knows about
 * breakpoints.
 */
export interface TourStep {
  target: string;
  title: AdminTranslationKey;
  body: AdminTranslationKey;
  /** Which side of the target the card sits on when there is room. */
  side: 'top' | 'right' | 'bottom' | 'left';
}

export const TOUR_STEPS: TourStep[] = [
  { target: 'property', title: 'tour.property.title', body: 'tour.property.body', side: 'right' },
  { target: 'menu', title: 'tour.menu.title', body: 'tour.menu.body', side: 'bottom' },
  { target: 'nav', title: 'tour.nav.title', body: 'tour.nav.body', side: 'right' },
  { target: 'orbit', title: 'tour.orbit.title', body: 'tour.orbit.body', side: 'right' },
  { target: 'bell', title: 'tour.bell.title', body: 'tour.bell.body', side: 'bottom' },
  { target: 'assistant', title: 'tour.assistant.title', body: 'tour.assistant.body', side: 'left' },
];

/** Bumped when the steps change enough that everyone should see them again. */
export const TOUR_STORAGE_KEY = 'admin-tour.seen.v1';

/** `/admin/account`'s own "show the hints" button asks the shell's tour to start over. */
export const TOUR_START_EVENT = 'admin-tour:start';
