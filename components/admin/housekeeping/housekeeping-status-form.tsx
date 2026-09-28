'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { setHousekeepingStatusAction } from '@/app/admin/housekeeping/actions';
import { HOUSEKEEPING_STATUSES } from '@/lib/domain/housekeeping';
import type { HousekeepingStatus } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { housekeepingStatusKey } from '@/lib/i18n/admin/housekeeping';
import { lRelativeTime } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { HousekeepingPhotoError, prepareHousekeepingPhoto, type HousekeepingPhotoErrorCode } from '@/lib/application/housekeeping-photo';
import { toast } from '@/components/admin/shell/toast';
import { HousekeepingStatusBadge, housekeepingStatusIcons, housekeepingStatusStyles } from './housekeeping-status-badge';

const photoErrorKeys: Record<HousekeepingPhotoErrorCode, 'housekeeping.invalidPhoto' | 'housekeeping.photoDecodeFailed' | 'housekeeping.photoProcessingFailed' | 'housekeeping.photoTooLarge' | 'housekeeping.readPhotoFailed'> = {
  invalid_type: 'housekeeping.invalidPhoto',
  decode_failed: 'housekeeping.photoDecodeFailed',
  processing_failed: 'housekeeping.photoProcessingFailed',
  too_large: 'housekeeping.photoTooLarge',
  read_failed: 'housekeeping.readPhotoFailed',
};

/**
 * The room's own page: every status as a tile to press, a note for the
 * desk, one save. The current status is shown, not greyed out, so a phone
 * in a corridor reads the room's state before anything else.
 */
export function HousekeepingStatusForm({
  unitId,
  status,
  note,
  updatedAt,
}: {
  unitId: string;
  status: HousekeepingStatus;
  note: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const t = useAdminT();
  const locale = useAdminLocale();
  const [selected, setSelected] = React.useState<HousekeepingStatus>(status);
  const [draftNote, setDraftNote] = React.useState(note ?? '');
  const [pending, setPending] = React.useState(false);
  const [photo, setPhoto] = React.useState<File | null>(null);
  // "Ago" moves between the server render and hydration, so it only appears once mounted.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const dirty = selected !== status || draftNote.trim() !== (note ?? '');

  const save = async () => {
    if (selected === 'clean' && !photo) {
      toast.error(t('housekeeping.photoRequired'));
      return;
    }
    setPending(true);
    try {
      const photoData = photo ? await prepareHousekeepingPhoto(photo) : null;
      const result = await setHousekeepingStatusAction(unitId, selected, draftNote, photoData);
      if (result.ok) { toast.success(result.message); router.refresh(); }
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof HousekeepingPhotoError ? t(photoErrorKeys[error.code]) : t('housekeeping.readPhotoFailed'));
    } finally { setPending(false); }
  };

  return (
    <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{t('housekeeping.currentStatus')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('housekeeping.currentStatusBody')}</p>
        </div>
        <HousekeepingStatusBadge status={status} />
      </div>

      <fieldset className="mt-5">
        <legend className="sr-only">{t('housekeeping.setStatus')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {HOUSEKEEPING_STATUSES.map((option) => {
            const Icon = housekeepingStatusIcons[option];
            const active = option === selected;
            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer flex-col items-start gap-2 rounded-2xl border p-4 text-sm font-medium transition-colors',
                  active ? 'border-foreground bg-stone/60' : 'border-border hover:bg-stone/40',
                )}
              >
                <input
                  type="radio"
                  name="housekeeping-status"
                  value={option}
                  checked={active}
                  onChange={() => setSelected(option)}
                  className="sr-only"
                />
                <span className={cn('grid size-8 place-items-center rounded-full', housekeepingStatusStyles[option])}>
                  <Icon weight="fill" className="size-4" aria-hidden="true" />
                </span>
                {t(housekeepingStatusKey(option))}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        {selected === 'clean' ? (
          <label className="mb-4 block text-sm font-medium">
            {t('housekeeping.photoFieldLabel')}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="mt-2 block w-full" />
          </label>
        ) : null}
        <label htmlFor="housekeeping-note" className="mb-1.5 block text-sm text-muted-foreground">
          {t('housekeeping.note')}
        </label>
        <textarea
          id="housekeeping-note"
          value={draftNote}
          onChange={(event) => setDraftNote(event.target.value)}
          rows={2}
          maxLength={200}
          className={cn(fieldClass, 'min-h-20 resize-y py-2.5')}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">{t('housekeeping.noteHint')}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !dirty} className={pill('primary', 'disabled:opacity-50')}>
          {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('housekeeping.save')}
        </button>
        <p className="text-sm text-muted-foreground">
          {updatedAt
            ? mounted
              ? t('housekeeping.lastUpdated', { time: lRelativeTime(updatedAt, locale) })
              : ''
            : t('housekeeping.notTouched')}
        </p>
      </div>
    </div>
  );
}
