'use server';

import { contentService } from '@/lib/application/container';
import type { SpinnerFrame } from '@/lib/domain/schemas';
import { revalidateContent } from '../../_lib/revalidate';

/**
 * One frame's bytes, from `frame-manager.tsx`'s in-browser re-encode. Called
 * once per frame while the picker uploads a new set, before anything in
 * `Hotel.spinner` changes — see `applySpinnerSceneAction`, which is what
 * actually points the spinner at these once every frame has a URL.
 */
export async function uploadSpinnerFrameAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const frameSetId = String(formData.get('frameSetId') ?? '');
  const rawIndex = formData.get('index');
  const file = formData.get('file');
  if (typeof rawIndex !== 'string' || rawIndex === '') return { ok: false, error: 'Missing frame index.' };
  const index = Number(rawIndex);
  if (!(file instanceof Blob)) return { ok: false, error: 'No file received.' };

  const result = await contentService.uploadSpinnerFrame(frameSetId, index, file.type, await file.arrayBuffer());
  if (!result.ok) {
    return { ok: false, error: result.error.kind === 'rule' ? result.error.message : 'Upload failed.' };
  }
  return { ok: true, url: result.value.url };
}

/**
 * Best-effort cleanup for a frame set that was uploaded but abandoned —
 * `frame-manager.tsx` calls this when a new upload replaces one that was
 * never carried through to `applySpinnerSceneAction`.
 */
export async function discardSpinnerFrameSetAction(frameSetId: string): Promise<void> {
  await contentService.discardSpinnerFrameSet(frameSetId);
}

export interface SpinnerSceneInput {
  frameWidth: number;
  frameHeight: number;
  frames: SpinnerFrame[];
  keyAngles: number[];
  startFrame: number;
}

/**
 * Points `Hotel.spinner` at the frames just uploaded (or just changes which
 * of the current ones are key angles) — see `ContentService.updateSpinnerScene`
 * for what resets and what doesn't, and for how it decides on its own,
 * server-side, whether a previous uploaded frame set needs sweeping from R2.
 */
export async function applySpinnerSceneAction(
  input: SpinnerSceneInput,
  expectedVersion: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await contentService.updateSpinnerScene(input, expectedVersion);
  if (result.ok) {
    revalidateContent();
    return { ok: true };
  }
  const error = result.error;
  return {
    ok: false,
    error:
      error.kind === 'rule'
        ? error.message
        : error.kind === 'conflict'
          ? 'Someone else changed the spinner while you were editing — reload and try again.'
          : error.kind === 'validation'
            ? Object.values(error.fieldErrors)[0]?.[0] ?? 'Invalid input.'
            : 'Could not save.',
  };
}
