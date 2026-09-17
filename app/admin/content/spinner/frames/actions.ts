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
  const index = Number(formData.get('index'));
  const file = formData.get('file');
  if (!(file instanceof Blob)) return { ok: false, error: 'No file received.' };

  const result = await contentService.uploadSpinnerFrame(frameSetId, index, file.type, await file.arrayBuffer());
  if (!result.ok) {
    return { ok: false, error: result.error.kind === 'rule' ? result.error.message : 'Upload failed.' };
  }
  return { ok: true, url: result.value.url };
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
 * for what resets and what doesn't. `previousFrameSetId` is passed only when
 * this call is replacing an uploaded set, so the old one can be swept from
 * storage once the new one is live.
 */
export async function applySpinnerSceneAction(
  input: SpinnerSceneInput,
  expectedVersion: number,
  previousFrameSetId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await contentService.updateSpinnerScene(input, expectedVersion, previousFrameSetId);
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
