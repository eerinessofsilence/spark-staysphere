'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLongRightIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Bed, SignIn, SignOut, Users } from '@phosphor-icons/react/dist/ssr';
import { setStayStateAction } from '@/app/admin/bookings/actions';
import { initialsOf } from '@/lib/application/team-directory';
import type { StayState } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { stayMoveKey } from '@/lib/i18n/admin/stay-state';
import { lDateShort, lGuests, lNights } from '@/lib/i18n/format';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';

const DAY_MS = 86_400_000;

/**
 * The one move the desk makes from a dashboard row — check this arrival in,
 * check that departure out — as a plain button rather than `StayStateMenu`'s
 * full list, since the row already says which move it is for. It asks once,
 * with the stay in front of the desk — the room's photograph, the guest, the
 * two dates — before anything changes.
 */
export function StayMoveButton({
  reference,
  from,
  to,
  guestName,
  roomName,
  roomPhoto,
  checkIn,
  checkOut,
  adults,
  children,
}: {
  reference: string;
  from: StayState;
  to: StayState;
  guestName: string;
  roomName: string;
  /** The room type's first photograph, if it has one. */
  roomPhoto?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}) {
  const router = useRouter();
  const t = useAdminT();
  const locale = useAdminLocale();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const close = React.useCallback(() => setOpen(false), []);
  const verb = t(stayMoveKey(from, to));
  const MoveIcon = to === 'checked_out' ? SignOut : SignIn;
  const nights = Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS));

  function confirm() {
    startTransition(async () => {
      const result = await setStayStateAction(reference, to);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary', 'min-h-9 px-3 text-xs')}>
        {verb}
      </button>

      <Modal open={open} onClose={close} title={`${verb} · ${reference}`} chrome={false} className="sm:max-w-md">
        {/* The room, edge to edge, with the move named over it — the same
            photograph-first treatment as a room card, not a table of facts. */}
        <div className={cn('relative h-44 shrink-0 overflow-hidden', roomPhoto ? 'bg-ink' : 'bg-stone')}>
          {roomPhoto ? (
            <img src={roomPhoto} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <Bed weight="fill" className="absolute inset-0 m-auto size-12 text-muted-foreground/60" aria-hidden="true" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/70 to-transparent" aria-hidden="true" />
          <button type="button" onClick={close} aria-label={t('frontDesk.cancel')} className={iconButton('glass', 'absolute top-3 right-3 size-10')}>
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
          <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                <MoveIcon weight="fill" className="size-4" aria-hidden="true" />
                {verb}
              </p>
              <p className="mt-0.5 truncate text-lg font-medium">{roomName}</p>
            </div>
            <p className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 font-mono text-xs backdrop-blur-sm">{reference}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-content-center rounded-full bg-stone text-sm font-medium" aria-hidden="true">
              {initialsOf(guestName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl leading-tight font-medium">{guestName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users weight="fill" className="size-4 shrink-0" aria-hidden="true" />
                {lGuests(adults, children, locale)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border p-4">
            <div className={cn('min-w-0 flex-1', to === 'checked_in' && 'font-medium')}>
              <p className="text-xs text-muted-foreground">{t('ops.thCheckIn')}</p>
              <p className="mt-0.5 text-base">{lDateShort(checkIn, locale)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-center text-muted-foreground">
              <ArrowLongRightIcon className="size-5" aria-hidden="true" />
              <span className="text-xs whitespace-nowrap">{lNights(nights, locale)}</span>
            </div>
            <div className={cn('min-w-0 flex-1 text-right', to === 'checked_out' && 'font-medium')}>
              <p className="text-xs text-muted-foreground">{t('ops.thCheckOut')}</p>
              <p className="mt-0.5 text-base">{lDateShort(checkOut, locale)}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
          <button type="button" onClick={close} disabled={pending} className={pill('secondary', 'min-h-10 px-4')}>
            {t('frontDesk.cancel')}
          </button>
          <button type="button" onClick={confirm} disabled={pending} className={pill('primary', 'min-h-10 px-5')}>
            {pending ? (
              <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MoveIcon weight="fill" className="size-4" aria-hidden="true" />
            )}
            {verb}
          </button>
        </div>
      </Modal>
    </>
  );
}
