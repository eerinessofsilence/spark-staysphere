'use client';

import * as React from 'react';
import { ArrowUpTrayIcon, StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import type { SpinnerFrame } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralCount } from '@/lib/i18n/plural';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import {
  applySpinnerSceneAction,
  discardSpinnerFrameSetAction,
  uploadSpinnerFrameAction,
  type SpinnerSceneInput,
} from './actions';

/** How many uploads run at once — fast enough for a few hundred frames, gentle enough not to flood R2. */
const UPLOAD_CONCURRENCY = 4;
/** Frames get no bigger than this on the long side; the orbit only ever shows them at stage size. */
const MAX_DIMENSION = 1920;

/** `frame-012.webp`, `IMG_7.jpg`, `7.png` all sort by their first run of digits, ties broken by name. */
function naturalCompare(a: File, b: File): number {
  const numberOf = (name: string) => Number(/\d+/.exec(name)?.[0] ?? Number.POSITIVE_INFINITY);
  return numberOf(a.name) - numberOf(b.name) || a.name.localeCompare(b.name);
}

/**
 * A worker that hits an error stops pulling new items immediately — without
 * this, the other workers keep uploading frames to R2 in the background
 * after the batch has already been reported as failed and discarded, orphaning
 * whatever they finish.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  let stopped = false;
  async function worker() {
    for (;;) {
      if (stopped) return;
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index]!, index);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Draws `bitmap` onto a canvas no larger than `MAX_DIMENSION` on its long side, and encodes it. */
async function encodeFrame(
  bitmap: ImageBitmap,
  unsupportedMessage: string,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(unsupportedMessage);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
  return { blob, width, height };
}

/** Evenly spaced stops across `count` frames — a reasonable default until the property picks its own. */
function defaultKeyAngles(count: number, stops = 4): number[] {
  const n = Math.min(stops, count);
  return Array.from({ length: n }, (_, i) => Math.round((i * count) / n));
}

export function FrameManager({
  initialFrames,
  initialFrameWidth,
  initialFrameHeight,
  initialKeyAngles,
  initialStartFrame,
  version,
  zoneCount,
  hotspotCount,
}: {
  initialFrames: SpinnerFrame[];
  initialFrameWidth: number;
  initialFrameHeight: number;
  initialKeyAngles: number[];
  initialStartFrame: number;
  version: number;
  zoneCount: number;
  hotspotCount: number;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const frameForms = { one: t('frames.countOne'), few: t('frames.countFew'), many: t('frames.countMany'), other: t('frames.countOther') };
  const markerForms = { one: t('frames.markerOne'), few: t('frames.markerFew'), many: t('frames.markerMany'), other: t('frames.markerOther') };
  const zoneForms = { one: t('zones.countOne'), few: t('zones.countFew'), many: t('zones.countMany'), other: t('zones.countOther') };

  const [frames, setFrames] = React.useState(initialFrames);
  const [frameWidth, setFrameWidth] = React.useState(initialFrameWidth);
  const [frameHeight, setFrameHeight] = React.useState(initialFrameHeight);
  const [keyAngles, setKeyAngles] = React.useState(new Set(initialKeyAngles));
  const [startFrame, setStartFrame] = React.useState(initialStartFrame);
  const [uploading, setUploading] = React.useState<{ done: number; total: number } | null>(null);
  const [error, setError] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /** Only set once a fresh batch has actually replaced `frames` — that's what `applySpinnerSceneAction` sweeps. */
  const pendingFrameSetIdRef = React.useRef<string | null>(null);
  const framesReplaced = pendingFrameSetIdRef.current !== null;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function onFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).sort(naturalCompare);
    event.target.value = ''; // lets the same folder be picked again after fixing a mistake
    if (files.length === 0) return;

    setError('');
    setUploading({ done: 0, total: files.length });

    // Replacing a set that was uploaded but never applied — sweep it rather
    // than leave it orphaned in R2.
    if (pendingFrameSetIdRef.current) void discardSpinnerFrameSetAction(pendingFrameSetIdRef.current);

    const frameSetId = crypto.randomUUID();

    try {
      // Encoded independently and concurrently, so completion order doesn't
      // match `index` order — dimensions are only compared once every frame
      // is back, against `encoded[0]` specifically (not "whichever finished
      // first").
      const encoded = await mapWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, index) => {
        const bitmap = await createImageBitmap(file);
        const { blob, width, height } = await encodeFrame(bitmap, t('frames.errBrowser'));
        bitmap.close();
        return { index, file, blob, width, height };
      });

      const { width: commonWidth, height: commonHeight } = encoded[0]!;
      const mismatch = encoded.find((frame) => frame.width !== commonWidth || frame.height !== commonHeight);
      if (mismatch) {
        throw new Error(
          t('frames.errMismatch', {
            index: mismatch.index + 1,
            name: mismatch.file.name,
            width: mismatch.width,
            height: mismatch.height,
            firstWidth: commonWidth,
            firstHeight: commonHeight,
          }),
        );
      }

      const uploaded = await mapWithConcurrency(encoded, UPLOAD_CONCURRENCY, async (frame) => {
        const formData = new FormData();
        formData.set('frameSetId', frameSetId);
        formData.set('index', String(frame.index));
        formData.set('file', frame.blob, `${frame.index}.webp`);
        const result = await uploadSpinnerFrameAction(formData);
        if (!result.ok) throw new Error(result.error);
        setUploading((current) => (current ? { ...current, done: current.done + 1 } : current));
        return { index: frame.index, imageUrl: result.url } satisfies SpinnerFrame;
      });

      uploaded.sort((a, b) => a.index - b.index);
      pendingFrameSetIdRef.current = frameSetId;
      setFrames(uploaded);
      setFrameWidth(commonWidth);
      setFrameHeight(commonHeight);
      const defaults = defaultKeyAngles(uploaded.length);
      setKeyAngles(new Set(defaults));
      setStartFrame(defaults[0] ?? 0);
      toast.success(t('frames.uploaded', { frames: pluralCount(locale, uploaded.length, frameForms) }));
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : t('frames.errUpload'));
    } finally {
      setUploading(null);
    }
  }

  function toggleKeyAngle(index: number) {
    setKeyAngles((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        if (next.size <= 2) {
          toast.error(t('frames.errMinKeyAngles'));
          return current;
        }
        next.delete(index);
        if (startFrame === index) setStartFrame(next.size > 0 ? Math.min(...next) : 0);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function requestApply() {
    if (keyAngles.size < 2) {
      toast.error(t('frames.errPickTwo'));
      return;
    }
    if (framesReplaced && (zoneCount > 0 || hotspotCount > 0)) {
      setConfirmOpen(true);
      return;
    }
    void apply();
  }

  async function apply() {
    setConfirmOpen(false);
    setSaving(true);
    const input: SpinnerSceneInput = {
      frameWidth,
      frameHeight,
      frames,
      keyAngles: [...keyAngles].sort((a, b) => a - b),
      startFrame,
    };
    const result = await applySpinnerSceneAction(input, version);
    setSaving(false);
    if (result.ok) {
      toast.success(t('frames.updated'));
      pendingFrameSetIdRef.current = null;
      window.location.reload(); // picks up the new version and, if frames were replaced, the cleared zones
    } else {
      toast.error(result.error);
    }
  }

  // The confirm only opens when at least one of the two counts is non-zero
  // (`requestApply`), so one of the three templates always applies.
  const markers = pluralCount(locale, hotspotCount, markerForms);
  const zones = pluralCount(locale, zoneCount, zoneForms);
  const replaceBody =
    hotspotCount > 0 && zoneCount > 0
      ? t('frames.replaceBodyBoth', { markers, zones })
      : hotspotCount > 0
        ? t('frames.replaceBodyMarkers', { markers })
        : t('frames.replaceBodyZones', { zones });

  return (
    <div className="mt-8 grid gap-6">
      <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-medium">{t('frames.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('frames.summary', { frames: pluralCount(locale, frames.length, frameForms), width: frameWidth, height: frameHeight })}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onFilesChosen}
            disabled={Boolean(uploading)}
          />
          <button
            type="button"
            className={pill('secondary')}
            disabled={Boolean(uploading)}
            onClick={() => fileInputRef.current?.click()}
          >
            <ArrowUpTrayIcon className="size-4" aria-hidden="true" />
            {t('frames.choose')}
          </button>
          {uploading ? (
            <span className="text-sm text-muted-foreground">
              {t('frames.uploading', { done: uploading.done, total: uploading.total })}
            </span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-[#dc2626]">{error}</p> : null}
        {framesReplaced ? <p className="mt-3 text-sm text-muted-foreground">{t('frames.newSetReady')}</p> : null}
      </div>

      <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-medium">{t('frames.keyAnglesHeading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('frames.keyAnglesBody')}</p>

        <ul className="mt-4 flex flex-wrap gap-3">
          {frames.map((frame) => {
            const isKey = keyAngles.has(frame.index);
            const isStart = startFrame === frame.index;
            return (
              <li key={frame.index} className="relative">
                <button
                  type="button"
                  onClick={() => toggleKeyAngle(frame.index)}
                  className={cn(
                    'block overflow-hidden rounded-2xl border-2 transition-colors',
                    isKey ? 'border-primary' : 'border-transparent hover:border-border',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame.imageUrl} alt="" width={96} height={54} className="h-14 w-24 bg-stone object-cover" />
                </button>
                <span className="mt-1 block text-center text-[11px] text-muted-foreground">
                  {t('frames.frameN', { n: frame.index })}
                </span>
                {isKey ? (
                  <button
                    type="button"
                    aria-label={isStart ? t('frames.opensOrbit', { n: frame.index }) : t('frames.openOn', { n: frame.index })}
                    title={t('frames.setStart')}
                    onClick={() => setStartFrame(frame.index)}
                    className={cn(
                      'absolute top-1 right-1 grid size-6 place-items-center rounded-full',
                      isStart ? 'bg-primary text-primary-foreground' : 'bg-black/40 text-white/80 hover:bg-black/60',
                    )}
                  >
                    {isStart ? (
                      <StarSolidIcon className="size-3.5" aria-hidden="true" />
                    ) : (
                      <StarOutlineIcon className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        <button type="button" className={cn(pill('primary'), 'mt-6')} disabled={saving || Boolean(uploading)} onClick={requestApply}>
          {saving ? t('frames.saving') : t('frames.apply')}
        </button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('frames.replaceTitle')}>
        <p className="text-sm text-muted-foreground">{replaceBody}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={pill('secondary')} onClick={() => setConfirmOpen(false)}>
            {t('frames.cancel')}
          </button>
          <button type="button" className={pill('primary')} onClick={() => void apply()}>
            {t('frames.replaceConfirm')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
