'use client';

import { Prohibit, PushPin } from '@phosphor-icons/react/dist/ssr';
import { LATE_CHECK_OUT_TIME, STANDARD_CHECK_IN_TIME, STANDARD_CHECK_OUT_TIME } from '@/lib/domain/stay-times';
import { useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { cn } from '@/lib/utils';
import { stayStatusMeta, stayStatusOrder, unavailablePattern, type StayStatus } from './front-desk-shared';

/** The team member's word for each stay status — `stayStatusMeta.label` is the English source. */
export const STAY_STATUS_KEY: Record<StayStatus, AdminTranslationKey> = {
  confirmed: 'frontDesk.stayConfirmed',
  due_in: 'frontDesk.stayDueIn',
  in_house: 'frontDesk.stayInHouse',
  due_out: 'frontDesk.stayDueOut',
  checked_out: 'frontDesk.stayCheckedOut',
  no_show: 'frontDesk.stayNoShow',
};

export function FrontDeskLegend() {
  const t = useAdminT();
  return (
    <ul
      aria-label={t('frontDesk.legend')}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
    >
      {stayStatusOrder.map((status) => (
        <li key={status} className="flex items-center gap-2">
          <span aria-hidden="true" className={cn('h-4 w-8 rounded-full', stayStatusMeta[status].className)} />
          {t(STAY_STATUS_KEY[status])}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-4 w-8 place-items-center rounded-full bg-danger/10 text-danger"
          style={unavailablePattern}
        >
          <Prohibit weight="fill" className="size-3" />
        </span>
        {t('frontDesk.closedToSale')}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-8 rounded-full border border-border bg-card" />
        {t('frontDesk.free')}
      </li>
      <li className="flex items-center gap-2">
        <PushPin weight="fill" className="size-4 text-foreground" aria-hidden="true" />
        {t('frontDesk.chosenByGuest')}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="relative h-4 w-8 overflow-hidden rounded-full bg-stone">
          <span className="absolute top-0 right-0 bottom-0 left-1/2 rounded-full bg-stay-confirmed" />
        </span>
        {t('frontDesk.stayTimingLegend', { checkIn: STANDARD_CHECK_IN_TIME, checkOut: STANDARD_CHECK_OUT_TIME })}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="relative h-4 w-8 overflow-hidden rounded-full bg-stone">
          <span className="absolute inset-y-0 left-1/2 right-0 rounded-full bg-stay-due-out" />
        </span>
        {t('frontDesk.lateCheckOutLegend', { time: LATE_CHECK_OUT_TIME })}
      </li>
    </ul>
  );
}
