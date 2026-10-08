'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { UploadDropzone } from '@/components/admin/content/upload-dropzone';
import { HousekeepingPhotoError } from '@/lib/application/housekeeping-photo';
import { appendMaintenancePhotos, type MaintenanceAttachment } from '@/lib/application/maintenance-photo';
import { MaintenanceCapture } from './maintenance-capture';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

export function MaintenancePhotoUpload({ issueId, hotelSlug, roomNumber, photoCount }: {
  issueId: string; hotelSlug: string; roomNumber: string; photoCount: number;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [photos, setPhotos] = React.useState<MaintenanceAttachment[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const lock = React.useRef(false);
  const key = React.useRef('');
  const remaining = Math.max(0, 5 - photoCount);
  React.useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo.file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  function addFiles(files: File[]) {
    if (lock.current) return;
    if (photos.length + files.length > remaining) { setError(t('maintenance.photoLimit')); return; }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError(t('maintenance.reportInvalid')); return; }
    key.current = crypto.randomUUID();
    setError(''); setPhotos((current) => [...current, ...files.map((file): MaintenanceAttachment => ({ file, view: 'photo' }))]);
  }

  async function save() {
    if (lock.current || !photos.length) return;
    lock.current = true; setBusy(true); setError('');
    setProgress({ done: 0, total: photos.length });
    try {
      const form = new FormData();
      form.set('hotelSlug', hotelSlug); form.set('idempotencyKey', key.current);
      await appendMaintenancePhotos(form, photos);
      setProgress({ done: photos.length, total: photos.length });
      const response = await fetch(`/api/admin/maintenance-issues/${encodeURIComponent(issueId)}/photos`, { method: 'POST', body: form });
      if (!response.ok) {
        setError(t(response.status === 401 || response.status === 403 ? 'team.permissionDenied' : response.status === 409 ? 'maintenance.photoLimit' : response.status === 400 || response.status === 413 ? 'maintenance.reportInvalid' : 'maintenance.photoUploadFailed'));
        return;
      }
      setPhotos([]); toast.success(t('maintenance.photosAdded')); router.refresh();
    } catch (cause) {
      setError(t(cause instanceof HousekeepingPhotoError ? 'maintenance.reportInvalid' : 'maintenance.photoUploadFailed'));
    } finally { lock.current = false; setBusy(false); setProgress(null); }
  }

  if (remaining === 0 && !photos.length) return <p className="mt-4 text-sm text-muted-foreground">{t('maintenance.photoLimit')}</p>;
  return <div className="mt-5 grid gap-3" aria-busy={busy}>
    <h3 className="text-sm font-medium">{t('maintenance.addPhotos')}</h3>
    {photos.length ? <div className="flex flex-wrap gap-4">
      {photos.map((photo, index) => <div key={`${photo.file.name}-${index}`} className="relative size-16">
        <img src={previews[index]} alt={t('maintenance.photoAlt', { room: roomNumber })} className="admin-grid-photo bg-stone" />
        <button type="button" disabled={busy} aria-label={t('maintenance.removePhoto', { number: index + 1 })}
          onClick={() => { key.current = crypto.randomUUID(); setPhotos((current) => current.filter((_, i) => i !== index)); }}
          className="absolute -top-2 -right-2 grid size-11 place-items-center rounded-full bg-card shadow-soft"><XMarkIcon className="size-5" aria-hidden="true" /></button>
      </div>)}
    </div> : null}
    <UploadDropzone compactMobile onFiles={addFiles} disabled={busy || photos.length >= remaining} progress={progress}
      chooseLabel={t('maintenance.uploadPhoto')} hint={t('maintenance.photoUploadHelp', { count: remaining })} errors={error ? [error] : []} />
    <label className={pill('secondary', 'relative min-h-12 w-fit overflow-hidden')}>
      <CameraIcon className="size-5" aria-hidden="true" />{t('maintenance.takePhoto')}
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy || photos.length >= remaining}
        aria-label={t('maintenance.takePhoto')} className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
    </label>
    <MaintenanceCapture disabled={busy || photos.length >= remaining} onCapture={(attachment) => {
      key.current = crypto.randomUUID(); setError(''); setPhotos((current) => [...current, attachment].slice(0, remaining));
    }} />
    {photos.length ? <button type="button" disabled={busy} onClick={() => void save()} className={pill('primary', 'min-h-12 w-fit')}>
      {t(busy ? 'maintenance.saving' : 'maintenance.savePhotos')}
    </button> : null}
  </div>;
}
