'use client';

import * as React from 'react';
import { CloudArrowUp, Star } from '@phosphor-icons/react/dist/ssr';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import type { SpinnerFrame } from '@/lib/domain/schemas';
import { frameSetIdOf } from '@/lib/domain/spinner-markup';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { applySpinnerSceneAction, uploadSpinnerFrameAction, type SpinnerSceneInput } from './actions';

/** How many uploads run at once — fast enough for a few hundred frames, gentle enough not to flood R2. */
const UPLOAD_CONCURRENCY = 4;
/** Frames get no bigger than this on the long side; the orbit only ever shows them at stage size. */
const MAX_DIMENSION = 1920;

/** `frame-012.webp`, `IMG_7.jpg`, `7.png` all sort by their first run of digits, ties broken by name. */
function naturalCompare(a: File, b: File): number {
  const numberOf = (name: string) => Number(/\d+/.exec(name)?.[0] ?? Number.POSITIVE_INFINITY);
  return numberOf(a.name) - numberOf(b.name) || a.name.localeCompare(b.name);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Draws `bitmap` onto a canvas no larger than `MAX_DIMENSION` on its long side, and encodes it. */
async function encodeFrame(bitmap: ImageBitmap): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot re-encode images — try a recent Chrome, Firefox or Safari.');
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

    const frameSetId = crypto.randomUUID();

    try {
      // Encoded independently and concurrently, so completion order doesn't
      // match `index` order — dimensions are only compared once every frame
      // is back, against `encoded[0]` specifically (not "whichever finished
      // first").
      const encoded = await mapWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, index) => {
        const bitmap = await createImageBitmap(file);
        const { blob, width, height } = await encodeFrame(bitmap);
        bitmap.close();
        return { index, file, blob, width, height };
      });

      const { width: commonWidth, height: commonHeight } = encoded[0]!;
      const mismatch = encoded.find((frame) => frame.width !== commonWidth || frame.height !== commonHeight);
      if (mismatch) {
        throw new Error(
          `Frame ${mismatch.index + 1} (${mismatch.file.name}) is ${mismatch.width}×${mismatch.height}, but frame 1 is ${commonWidth}×${commonHeight} — every frame must share one framing.`,
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
      toast.success(`Uploaded ${uploaded.length} frames.`);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Upload failed.');
    } finally {
      setUploading(null);
    }
  }

  function toggleKeyAngle(index: number) {
    setKeyAngles((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        if (next.size <= 2) {
          toast.error('At least two key angles are needed — the arrows have to have somewhere to jump between.');
          return current;
        }
        next.delete(index);
        if (startFrame === index) setStartFrame([...next][0] ?? 0);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function requestApply() {
    if (keyAngles.size < 2) {
      toast.error('Pick at least two key angles first.');
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
    const previousFrameSetId = framesReplaced ? (frameSetIdOf(initialFrames[0]?.imageUrl ?? '') ?? undefined) : undefined;
    const result = await applySpinnerSceneAction(input, version, previousFrameSetId);
    setSaving(false);
    if (result.ok) {
      toast.success('Spinner updated.');
      pendingFrameSetIdRef.current = null;
      window.location.reload(); // picks up the new version and, if frames were replaced, the cleared zones
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="mt-8 grid gap-6">
      <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-medium">Frames</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {frames.length} frames, {frameWidth}×{frameHeight}. Choosing a new set re-encodes every image to WebP in your
          browser before uploading — nothing leaves the tab unresized.
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
            <CloudArrowUp weight="fill" className="size-4" aria-hidden="true" />
            Choose frame images…
          </button>
          {uploading ? (
            <span className="text-sm text-muted-foreground">
              Uploading {uploading.done} of {uploading.total}…
            </span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-[#dc2626]">{error}</p> : null}
        {framesReplaced ? (
          <p className="mt-3 text-sm text-muted-foreground">
            A new set is ready below — nothing is saved until you apply it.
          </p>
        ) : null}
      </div>

      <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-medium">Key angles and start frame</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a frame to make it a stop the arrows jump between. The star picks which one the orbit opens on.
        </p>

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
                <span className="mt-1 block text-center text-[11px] text-muted-foreground">Frame {frame.index}</span>
                {isKey ? (
                  <button
                    type="button"
                    aria-label={isStart ? `Frame ${frame.index} opens the orbit` : `Open the orbit on frame ${frame.index}`}
                    title="Set as start frame"
                    onClick={() => setStartFrame(frame.index)}
                    className={cn(
                      'absolute top-1 right-1 grid size-6 place-items-center rounded-full',
                      isStart ? 'bg-primary text-primary-foreground' : 'bg-black/40 text-white/80 hover:bg-black/60',
                    )}
                  >
                    <Star weight={isStart ? 'fill' : 'regular'} className="size-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        <button type="button" className={cn(pill('primary'), 'mt-6')} disabled={saving || Boolean(uploading)} onClick={requestApply}>
          {saving ? 'Saving…' : 'Apply'}
        </button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Replace the spinner's frames?">
        <p className="text-sm text-muted-foreground">
          {hotspotCount > 0 ? `${hotspotCount} marker${hotspotCount === 1 ? '' : 's'} (sea-view, floor pins, …) ` : ''}
          {hotspotCount > 0 && zoneCount > 0 ? 'and ' : ''}
          {zoneCount > 0 ? `${zoneCount} zone${zoneCount === 1 ? '' : 's'} drawn in Markup ` : ''}
          {hotspotCount > 0 || zoneCount > 0 ? 'name frame numbers from the current sequence and ' : ''}
          will be cleared, since they can no longer be trusted to line up with the new one. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={pill('secondary')} onClick={() => setConfirmOpen(false)}>
            Cancel
          </button>
          <button type="button" className={pill('primary')} onClick={() => void apply()}>
            Replace and clear them
          </button>
        </div>
      </Modal>
    </div>
  );
}
