'use client';

import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { TOUR_START_EVENT } from '@/components/admin/onboarding/tour-steps';

/**
 * Plays the first-run hints again. The tour itself lives in `AdminShell`
 * (`AdminTour`), which is above this page rather than around it, so the
 * button asks for it through a window event instead of threading a callback
 * up through the layout.
 */
export function TourSettings() {
  const t = useAdminT();

  return (
    <div role="group" aria-labelledby="tour-heading" className="rounded-[18px] bg-card p-6 shadow-soft">
      <h2 id="tour-heading" className="text-lg font-medium">
        {t('tour.settingsTitle')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('tour.settingsBody')}</p>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
        className={pill('secondary', 'mt-5')}
      >
        {t('tour.settingsButton')}
      </button>
    </div>
  );
}
