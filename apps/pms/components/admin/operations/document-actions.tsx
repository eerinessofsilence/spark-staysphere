'use client';
import { useEffect, useState } from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { Menu } from '@base-ui/react/menu';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import type { GuestDocument, GuestIdentity } from '@/lib/domain/guest-document';
import { changeDocumentAction } from '@/app/admin/guests/documents/actions';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { Modal } from '@/components/site/modal';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { menuItemClass } from './booking-row-actions';

export function DocumentActions({ document, editButton = false, onSaved }: { document: Pick<GuestDocument, 'id' | 'status' | 'identity'>; editButton?: boolean; onSaved?: () => void }) {
  const locale = useAdminLocale();
  const t = useAdminT();
  const router = useRouter();
  const c = locale === 'ru' ? { actions: 'Действия с документом', edit: 'Редактировать', remove: 'Удалить фото', confirm: 'Фото будет удалено без возможности восстановления. Данные документа останутся в истории.', save: 'Сохранить', error: 'Не удалось сохранить изменения. Проверьте поля и попробуйте снова.' } : locale === 'de' ? { actions: 'Dokumentaktionen', edit: 'Bearbeiten', remove: 'Foto löschen', confirm: 'Das Foto wird unwiderruflich gelöscht. Die Dokumentdaten bleiben erhalten.', save: 'Speichern', error: 'Änderungen konnten nicht gespeichert werden. Prüfen Sie die Felder.' } : { actions: 'Document actions', edit: 'Edit', remove: 'Delete photo', confirm: 'The photo will be permanently deleted. Document details remain in the history.', save: 'Save', error: 'Unable to save changes. Check the fields and try again.' };
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null);
  const [draft, setDraft] = useState<GuestIdentity>(document.identity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [photoError, setPhotoError] = useState(false);
  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const canUpload = document.status === 'active' || document.status === 'uploading';
  const photoLabel = locale === 'ru' ? 'Фото документа' : locale === 'de' ? 'Dokumentfoto' : 'Document photo';
  const close = () => { if (!busy) { setMode(null); setError(false); } };
  const fields = ['firstName', 'lastName', 'documentNumber', 'issuingCountry', 'nationality', 'dateOfBirth', 'issueDate', 'expirationDate'] as const;
  const save = async () => {
    setBusy(true); setError(false);
    const upload = photo && mode === 'edit' ? new FormData() : undefined;
    if (upload && photo) upload.set('photo', photo);
    const result = await changeDocumentAction(document.id, mode === 'edit' ? draft : null, upload);
    setBusy(false);
    if (!result.ok) { setError(true); return; }
    setMode(null); onSaved?.(); router.refresh();
  };
  return <div onClick={(event) => event.stopPropagation()}>
    {editButton ? <button type="button" className={pill('primary')} onClick={() => { setDraft(document.identity); setPhoto(null); setPhotoError(false); setMode('edit'); }}>{c.edit}</button> : <Menu.Root modal={false}><Menu.Trigger aria-label={c.actions} className={iconButton('light', 'size-10')}><EllipsisHorizontalIcon className="size-5" /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner side="bottom" align="end" className="z-50"><Menu.Popup className="rounded-2xl border border-border bg-card p-1.5 shadow-soft">
        <Menu.Item className={menuItemClass} onClick={() => { setDraft(document.identity); setPhoto(null); setPhotoError(false); setMode('edit'); }}>{c.edit}</Menu.Item>
        <Menu.Item disabled={document.status === 'deleted' || document.status === 'pending_deletion'} className={menuItemClass} onClick={() => setMode('delete')}>{c.remove}</Menu.Item>
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>}
    <Modal open={mode !== null} onClose={close} title={mode === 'edit' ? c.edit : c.remove}>
      {mode === 'edit' && <div className="mb-5 grid gap-3">
        <label className="grid gap-2 text-sm"><span className="font-medium">{photoLabel}</span>
          <input type="file" accept="image/jpeg,image/png" disabled={busy || !canUpload} onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) { setPhoto(null); setPhotoError(false); return; }
            if (!['image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) { setPhotoError(true); setPhoto(null); event.target.value = ''; return; }
            setPhotoError(false); setPhoto(file);
          }} className="block w-full rounded-2xl border border-border p-3 file:mr-3 file:rounded-full file:border-0 file:bg-stone file:px-4 file:py-2" />
        </label>
        <p className="text-xs text-muted-foreground">{canUpload ? 'JPEG / PNG · max. 8 MB' : t('documents.imageUnavailable')}</p>
        {photoError && <p role="alert" className="text-sm text-danger">JPEG / PNG · max. 8 MB</p>}
        {(preview || document.status === 'active') && <img key={preview || document.id} src={preview || `/admin/guests/documents/${encodeURIComponent(document.id)}/image`} alt={photoLabel} className="max-h-64 w-full rounded-2xl bg-stone object-contain" />}
        {photo && <button type="button" disabled={busy} className={pill('secondary', 'justify-self-start')} onClick={() => setPhoto(null)}>{t('documents.close')}</button>}
      </div>}
      {mode === 'edit' ? <div className="grid gap-4 sm:grid-cols-2">{fields.map((key) => <label key={key} className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{key === 'firstName' ? t('account.firstName') : key === 'lastName' ? t('account.lastName') : t(`documents.${key}`)}</span><input disabled={busy} className={fieldClass} type={['dateOfBirth', 'issueDate', 'expirationDate'].includes(key) ? 'date' : 'text'} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</div> : <p>{c.confirm}</p>}
      {error && <p role="alert" className="mt-4 text-danger">{c.error}</p>}
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy} onClick={close} className={pill('secondary')}>{t('documents.close')}</button><button type="button" disabled={busy || photoError} onClick={save} className={pill('primary')}>{mode === 'edit' ? c.save : c.remove}</button></div>
    </Modal>
  </div>;
}
