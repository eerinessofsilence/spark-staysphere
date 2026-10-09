'use client';

import * as React from 'react';
import { assistantMediaAction } from '@/app/admin/assistant/actions';
import type { MediaAsset } from '@/lib/domain/ports';
import { MAX_GALLERY_PHOTOS } from '@/lib/domain/photo-upload';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { PhotoListEditor } from '@/components/admin/content/photo-list-editor';

export function ServicePhotosStep({ busy, initial, onChange, onContinue, onBusyChange }: {
  busy: boolean;
  initial: string[];
  onChange: (photos: string[]) => void;
  onContinue: (photos: string[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useAdminT();
  const [assets, setAssets] = React.useState<MediaAsset[]>([]);
  const [initialPhotos] = React.useState(initial);
  const [photos, setPhotos] = React.useState(initial);
  const updatePhotos = React.useCallback((urls: string[]) => { setPhotos(urls); onChange(urls); }, [onChange]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void assistantMediaAction().then((result) => {
      if (active) setAssets(result);
    }).catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  return <div className="grid gap-3 rounded-2xl border border-border bg-card p-3.5">
    {loading ? <p role="status" className="text-sm text-muted-foreground">{t('assistant.photos.loading')}</p> : null}
    {failed ? <p role="alert" className="text-sm text-danger">
      {t('assistant.photos.failed')}{' '}
      <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>{t('assistant.photos.retry')}</button>
    </p> : null}
    <PhotoListEditor name="assistant-photos" initial={initialPhotos} assets={assets} onChange={updatePhotos} onBusyChange={onBusyChange} />
    <p role="status" className="text-xs text-muted-foreground">{t('assistant.photos.count', { count: photos.length, max: MAX_GALLERY_PHOTOS })}</p>
    <button type="button" disabled={busy} className={pill('primary', 'justify-center text-sm')} onClick={() => onContinue(photos)}>
      {t(photos.length ? 'assistant.photos.continue' : 'assistant.photos.skip')}
    </button>
  </div>;
}
