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

export const HOUSEKEEPER_TOUR_START_EVENT = 'housekeeper-tour:start';
export const HOUSEKEEPER_TOUR_STEPS: TourStep[] = [
  { target: 'housekeeper-room', title: 'tour.housekeeperRoom.title', body: 'tour.housekeeperRoom.body', side: 'bottom' },
  { target: 'housekeeper-cleaning', title: 'tour.housekeeperCleaning.title', body: 'tour.housekeeperCleaning.body', side: 'bottom' },
  { target: 'housekeeper-report', title: 'tour.housekeeperReport.title', body: 'tour.housekeeperReport.body', side: 'bottom' },
  { target: 'housekeeper-repairs', title: 'tour.housekeeperRepairs.title', body: 'tour.housekeeperRepairs.body', side: 'bottom' },
];

export const HOUSEKEEPER_REPORT_TOUR_START_EVENT = 'housekeeper-report-tour:start';
export const HOUSEKEEPER_REPORT_TOUR_STEPS: TourStep[] = [
  { target: 'repair-category', title: 'tour.repairCategory.title', body: 'tour.repairCategory.body', side: 'bottom' },
  { target: 'repair-photos', title: 'tour.repairPhotos.title', body: 'tour.repairPhotos.body', side: 'bottom' },
  { target: 'repair-description', title: 'tour.repairDescription.title', body: 'tour.repairDescription.body', side: 'top' },
  { target: 'repair-send', title: 'tour.repairSend.title', body: 'tour.repairSend.body', side: 'top' },
];

export const MAINTENANCE_TOUR_STEPS: TourStep[] = [
  { target: 'maintenance-report', title: 'tour.maintenanceReport.title', body: 'tour.maintenanceReport.body', side: 'bottom' },
  { target: 'maintenance-filters', title: 'tour.maintenanceFilters.title', body: 'tour.maintenanceFilters.body', side: 'bottom' },
  { target: 'maintenance-issues', title: 'tour.maintenanceIssues.title', body: 'tour.maintenanceIssues.body', side: 'top' },
];
export const MAINTENANCE_REPORT_TOUR_STEPS: TourStep[] = [
  { target: 'repair-room', title: 'tour.repairRoom.title', body: 'tour.repairRoom.body', side: 'bottom' },
  ...HOUSEKEEPER_REPORT_TOUR_STEPS.map((step) => step.target === 'repair-send'
    ? { ...step, body: 'tour.maintenanceSend.body' as const } : step),
];
export const MAINTENANCE_DETAIL_TOUR_STEPS: TourStep[] = [
  { target: 'maintenance-evidence', title: 'tour.maintenanceEvidence.title', body: 'tour.maintenanceEvidence.body', side: 'top' },
  { target: 'maintenance-status', title: 'tour.maintenanceStatus.title', body: 'tour.maintenanceStatus.body', side: 'top' },
  { target: 'maintenance-availability', title: 'tour.maintenanceAvailability.title', body: 'tour.maintenanceAvailability.body', side: 'top' },
];
