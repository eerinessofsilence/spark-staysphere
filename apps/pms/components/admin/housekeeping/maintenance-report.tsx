'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CameraIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { NativeSelect } from '@/components/ui/native-select';
import { UploadDropzone } from '@/components/admin/content/upload-dropzone';
import { AdminTour } from '@/components/admin/onboarding/admin-tour';
import { MaintenanceTour } from '@/components/admin/onboarding/maintenance-tour';
import { MAINTENANCE_REPORT_TOUR_STEPS } from '@/components/admin/onboarding/tour-steps';
import { HousekeepingPhotoError } from '@/lib/application/housekeeping-photo';
import { appendMaintenancePhotos, type MaintenanceAttachment } from '@/lib/application/maintenance-photo';
import { MaintenanceCapture } from './maintenance-capture';
import { MAINTENANCE_ISSUE_CATEGORIES } from '@/lib/domain/maintenance-issue';
import { useAdminT } from '@/lib/i18n/admin/context';
import { maintenanceCategoryKeys } from '@/lib/i18n/admin/maintenance';
import { fieldClass, pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

export function MaintenanceReport({ hotelSlug, memberKey, rooms }: {
  hotelSlug: string; memberKey: string; rooms: { id: string; number: string }[];
}) {
  const t = useAdminT();
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [unitId, setUnitId] = React.useState('');
  const [category, setCategory] = React.useState<string>(MAINTENANCE_ISSUE_CATEGORIES[0]);
  const [description, setDescription] = React.useState('');
  const [photos, setPhotos] = React.useState<MaintenanceAttachment[]>([]);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const key = React.useRef('');
  const lock = React.useRef(false);
  React.useEffect(() => setReady(true), []);
  React.useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo.file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  function addPhotos(files: File[]) {
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) || photos.length + files.length > 5) {
      setError(t('maintenance.reportInvalid')); return;
    }
    setError(''); setPhotos((current) => [...current, ...files.map((file): MaintenanceAttachment => ({ file, view: 'photo' }))]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (!unitId || photos.length === 0) { setError(t('maintenance.reportRequired')); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const form = new FormData();
      form.set('hotelSlug', hotelSlug); form.set('unitId', unitId);
      form.set('category', category); form.set('description', description);
      form.set('idempotencyKey', key.current);
      await appendMaintenancePhotos(form, photos);
      const response = await fetch('/api/admin/maintenance-issues', { method: 'POST', body: form });
      if (!response.ok) {
        setError(t(response.status === 401 || response.status === 403 ? 'team.permissionDenied' : response.status === 400 || response.status === 413 ? 'maintenance.reportInvalid' : 'maintenance.reportFailed'));
        return;
      }
      setOpen(false); setPhotos([]); setDescription(''); setUnitId('');
      toast.success(t('maintenance.reportCreated'));
      router.refresh();
    } catch (cause) {
      setError(t(cause instanceof HousekeepingPhotoError ? 'maintenance.reportInvalid' : 'maintenance.reportFailed'));
    } finally { lock.current = false; setBusy(false); }
  }

  return <>
    <button type="button" data-tour="maintenance-report" disabled={!ready || rooms.length === 0}
      className={pill('primary')} onClick={() => {
        key.current = crypto.randomUUID(); setUnitId(''); setCategory(MAINTENANCE_ISSUE_CATEGORIES[0]);
        setPhotos([]); setDescription(''); setError(''); setOpen(true);
      }}><PlusIcon className="size-5" aria-hidden="true" />{t('maintenance.report')}</button>
    <MaintenanceTour memberKey={memberKey} paused={open} />
    <Modal open={open} onClose={() => { if (!lock.current) setOpen(false); }} title={t('maintenance.report')}
      sheet fullScreen className="max-h-[100dvh] overflow-y-auto sm:max-h-[90dvh]">
      {open ? <form onSubmit={submit} className="grid gap-5" aria-busy={busy}>
        <p className="text-sm text-muted-foreground">{t('maintenance.reportBody')}</p>
        <label data-tour="repair-room" className="grid gap-2 text-sm font-medium">{t('maintenance.room')}
          <NativeSelect required disabled={busy} value={unitId} onChange={(event) => setUnitId(event.target.value)}>
            <option value="">{t('maintenance.chooseRoom')}</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.number}</option>)}
          </NativeSelect>
        </label>
        <label data-tour="repair-category" className="grid gap-2 text-sm font-medium">{t('maintenance.category')}
          <NativeSelect required disabled={busy} value={category} onChange={(event) => setCategory(event.target.value)}>
            {MAINTENANCE_ISSUE_CATEGORIES.map((value) => <option key={value} value={value}>{t(maintenanceCategoryKeys[value])}</option>)}
          </NativeSelect>
        </label>
        <div data-tour="repair-photos" className="grid gap-2">
          <p className="text-sm font-medium">{t('maintenance.reportPhotos')}</p>
          <p className="text-sm text-muted-foreground">{t('maintenance.reportPhotosHelp')}</p>
          {photos.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => <div key={`${photo.file.name}-${index}`} className="relative size-16">
              <img src={previews[index]} alt={t('maintenance.photoAlt', { room: rooms.find((room) => room.id === unitId)?.number ?? '—' })} className="admin-grid-photo bg-stone" />
              <button type="button" disabled={busy} aria-label={t('maintenance.removePhoto', { number: index + 1 })}
                onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                className="absolute -top-2 -right-2 grid size-11 place-items-center rounded-full bg-card text-foreground shadow-soft"><XMarkIcon className="size-5" aria-hidden="true" /></button>
            </div>)}
          </div> : null}
          {photos.length < 5 ? <div className="grid gap-3">
            <label className={pill('primary', 'relative min-h-12 justify-center overflow-hidden')}>
              <CameraIcon className="size-5" aria-hidden="true" />{t('maintenance.takePhoto')}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy}
                onChange={(event) => { addPhotos(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }}
                aria-label={t('maintenance.takePhoto')} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <MaintenanceCapture disabled={busy} onOpenChange={setCaptureOpen} onCapture={(attachment) => setPhotos((current) => [...current, attachment].slice(0, 5))} />
            <UploadDropzone compactMobile onFiles={addPhotos} disabled={busy} chooseLabel={t('maintenance.uploadPhoto')}
              hint={t('maintenance.photoUploadHelp', { count: 5 - photos.length })} />
          </div> : null}
        </div>
        <label data-tour="repair-description" className="grid gap-2 text-sm font-medium">{t('maintenance.description')}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} disabled={busy}
            className={`${fieldClass} min-h-32 resize-y`} placeholder={t('maintenance.reportPlaceholder')} aria-describedby="admin-maintenance-description-help" />
          <span id="admin-maintenance-description-help" className="text-xs font-normal text-muted-foreground">{t('maintenance.reportDescriptionHelp')}</span>
        </label>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <button type="submit" data-tour="repair-send" disabled={busy || !unitId || photos.length === 0}
          className={pill('primary', 'min-h-12 w-full justify-center disabled:opacity-50')}>
          {t(busy ? 'maintenance.reportSending' : 'maintenance.sendReport')}
        </button>
        {!busy && !captureOpen ? <AdminTour tourSteps={MAINTENANCE_REPORT_TOUR_STEPS} storageKey={`maintenance-report-tour.${memberKey}.seen.v1`}
          startEvent="maintenance-report-tour:start" modal /> : null}
      </form> : null}
    </Modal>
  </>;
}
