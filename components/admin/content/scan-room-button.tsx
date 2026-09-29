'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, CameraIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { attachScanToRoomAction, createScannedRoomAction, recognizeRoomAction, uploadRoomPanoramaAction } from '@/app/admin/content/rooms/scan/actions';
import type { MediaAsset } from '@/lib/domain/ports';
import type { RoomGuess } from '@/lib/domain/room-recognition';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { BED_LABEL, VIEW_LABEL } from '@/lib/i18n/format';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { toast } from '@/components/admin/shell/toast';
import { Field, Select, TextArea, TextInput } from './fields';
import { labelOptions } from './label-options';
import { ScanModal } from './scan-modal';

type Draft = { asset: MediaAsset; guess: RoomGuess | null; panoramaUrl: string | null };

/**
 * A room photographed from the doorway becomes a room type: the photo is
 * its cover, the recognizer fills in name, size, sleeps, bed, view and the
 * amenities in shot, and the desk checks the draft before it is created.
 * The type starts hidden like one made on `/admin/content/rooms/new` —
 * rooms and a rate come next, on the page this opens.
 */
/** A room type the scan can be added to — the page passes the hotel's own list. */
export interface ScanRoomOption {
  id: string;
  name: string;
}

export function ScanRoomButton({ rooms }: { rooms: ScanRoomOption[] }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  // Where the scan goes: onto a type the hotel already has (the usual case —
  // a tour is recorded in a room that is already on sale) or a new one.
  const [target, setTarget] = React.useState<'existing' | 'new'>(rooms.length > 0 ? 'existing' : 'new');
  const [roomId, setRoomId] = React.useState(rooms[0]?.id ?? '');

  function attach(draft: Draft) {
    const room = rooms.find((option) => option.id === roomId);
    if (!room) return;
    startSaving(async () => {
      const result = await attachScanToRoomAction({ roomId: room.id, photoUrl: draft.asset.url, panoramaUrl: draft.panoramaUrl });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(t('scanRoom.attached', { name: room.name }));
      setOpen(false);
      router.push(`/admin/content/rooms/${result.id}#room-media`);
    });
  }

  async function recognize(file: File, panorama: File | null) {
    const body = new FormData();
    body.set('file', file);
    const result = await recognizeRoomAction(body);
    if (!result.ok) return result;
    // The tour goes up beside the cover: its own upload, filed as a panorama.
    let panoramaUrl: string | null = null;
    if (panorama) {
      const tourBody = new FormData();
      tourBody.set('file', panorama);
      const uploaded = await uploadRoomPanoramaAction(tourBody);
      if (!uploaded.ok) return uploaded;
      panoramaUrl = uploaded.url;
    }
    return { ok: true as const, draft: { asset: result.asset, guess: result.guess, panoramaUrl } };
  }

  function submitDraft(event: React.FormEvent<HTMLFormElement>, draft: Draft) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    startSaving(async () => {
      const result = await createScannedRoomAction({
        name,
        description: String(data.get('description') ?? '').trim(),
        areaM2: Number(data.get('areaM2') ?? 0),
        floor: Number(data.get('floor') ?? 0),
        capacity: Number(data.get('capacity') ?? 0),
        bedType: String(data.get('bedType') ?? 'king'),
        view: String(data.get('view') ?? 'sea'),
        amenities: String(data.get('amenities') ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        photoUrl: draft.asset.url,
        panoramaUrl: draft.panoramaUrl,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(t('scanRoom.added', { name }));
      setOpen(false);
      // The scan starts from the room-type catalog. Return there after the
      // save so the newly created type is immediately visible at the top of
      // the grid instead of leaving the operator on a detail page.
      router.push('/admin/content');
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        <CameraIcon className="size-4" aria-hidden="true" />
        {t('scanRoom.button')}
      </button>

      <ScanModal<Draft> open={open} onClose={() => setOpen(false)} title={t('scanRoom.title')} intro={t('scanRoom.intro')} tour recognize={recognize}>
        {(draft, photoUrl, retake, panoramaUrl) => {
          const guess = draft.guess;
          const known = guess !== null && guess.recognized ? guess : null;
          const targetToggle =
            rooms.length > 0 ? (
              <div role="group" aria-label={t('scanRoom.target')} className="flex gap-1 self-start rounded-full bg-stone p-1">
                {(['existing', 'new'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTarget(option)}
                    aria-pressed={target === option}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors',
                      target === option ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {option === 'existing' ? t('scanRoom.attachExisting') : t('scanRoom.createNew')}
                  </button>
                ))}
              </div>
            ) : null;
          if (target === 'existing' && rooms.length > 0) {
            return (
              <div className="grid gap-4">
                {targetToggle}
                <div className="flex items-start gap-4">
                  <img src={photoUrl} alt="" className="size-24 shrink-0 rounded-2xl object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{t('scanRoom.attachCheck')}</p>
                    {panoramaUrl ? (
                      <p className={tag('mt-2')}>
                        <GlobeAltIcon className="size-3.5" aria-hidden="true" />
                        {t('scanRoom.tourAttached')}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Field id="scan-room-target" name="roomId" label={t('scanRoom.roomType')}>
                  <Select id="scan-room-target" name="roomId" value={roomId} onChange={(next) => setRoomId(next)}>
                    {rooms.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </Select>
                </Field>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={saving} onClick={retake} className={pill('secondary')}>
                    {t('scan.retake')}
                  </button>
                  <button type="button" disabled={saving || !roomId} onClick={() => attach(draft)} className={pill('primary')}>
                    {saving ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                    {t('scanRoom.attach')}
                  </button>
                </div>
              </div>
            );
          }
          return (
            <form onSubmit={(event) => submitDraft(event, draft)} className="grid gap-4">
              {targetToggle}
              <div className="flex items-start gap-4">
                <img src={photoUrl} alt="" className="size-24 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {guess === null ? t('scan.noModel') : known === null ? t('scanRoom.notRecognized') : t('scanRoom.check')}
                  </p>
                  {panoramaUrl ? (
                    <p className={tag('mt-2')}>
                      <GlobeAltIcon className="size-3.5" aria-hidden="true" />
                      {t('scanRoom.tourAttached')}
                    </p>
                  ) : null}
                </div>
              </div>
              <Field id="scan-room-name" name="name" label={t('room.name')}>
                <TextInput id="scan-room-name" name="name" defaultValue={known?.name ?? ''} required />
              </Field>
              <Field id="scan-room-description" name="description" label={t('room.descriptionLabel')}>
                <TextArea id="scan-room-description" name="description" defaultValue={known?.description ?? ''} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="scan-room-areaM2" name="areaM2" label={t('room.size')}>
                  <TextInput id="scan-room-areaM2" name="areaM2" type="number" min={1} step="0.1" defaultValue={known?.areaM2 ?? ''} required />
                </Field>
                <Field id="scan-room-floor" name="floor" label={t('room.floor')}>
                  <TextInput id="scan-room-floor" name="floor" type="number" min={0} step="1" defaultValue={1} required />
                </Field>
                <Field id="scan-room-capacity" name="capacity" label={t('room.sleeps')}>
                  <TextInput id="scan-room-capacity" name="capacity" type="number" min={1} step="1" defaultValue={known?.capacity ?? 2} required />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="scan-room-bedType" name="bedType" label={t('room.bed')}>
                  <Select id="scan-room-bedType" name="bedType" defaultValue={known?.bedType ?? 'king'} required>
                    {labelOptions(BED_LABEL[locale])}
                  </Select>
                </Field>
                <Field id="scan-room-view" name="view" label={t('room.view')}>
                  <Select id="scan-room-view" name="view" defaultValue={known?.view ?? 'sea'} required>
                    {labelOptions(VIEW_LABEL[locale])}
                  </Select>
                </Field>
              </div>
              <Field id="scan-room-amenities" name="amenities" label={t('room.amenities')} hint={t('scanRoom.amenitiesHint')}>
                <TextInput id="scan-room-amenities" name="amenities" defaultValue={known?.amenities.join(', ') ?? ''} />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={saving} onClick={retake} className={pill('secondary')}>
                  {t('scan.retake')}
                </button>
                <button type="submit" disabled={saving} className={pill('primary')}>
                  {saving ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {t('scanRoom.add')}
                </button>
              </div>
            </form>
          );
        }}
      </ScanModal>
    </>
  );
}
