'use client';

import { AdminTour } from './admin-tour';
import { MAINTENANCE_DETAIL_TOUR_STEPS, MAINTENANCE_TOUR_STEPS } from './tour-steps';

export function MaintenanceTour({ memberKey, detail = false, paused = false }: { memberKey: string; detail?: boolean; paused?: boolean }) {
  const mode = detail ? 'detail' : 'list';
  const startEvent = `maintenance-${mode}-tour:start`;
  return paused ? null : <AdminTour tourSteps={detail ? MAINTENANCE_DETAIL_TOUR_STEPS : MAINTENANCE_TOUR_STEPS}
    storageKey={`maintenance-${mode}-tour.${memberKey}.seen.v1`} startEvent={startEvent} />;
}
