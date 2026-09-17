'use server';

import { contentService } from '@/lib/application/container';
import { revalidateContent } from '../../_lib/revalidate';

/**
 * The autosave endpoint the ported `PolygonEditor` calls: one batch per key-
 * angle frame, `{ upserts: [{ id, polygon, target }], deletes: [id] }`. Its
 * return shape — `{ ok: true } | { ok: false, error }` — is exactly what the
 * editor's `onSave` expects (see `components/admin/spinner-markup/polygon-
 * editor.tsx`), so no `formStateFromResult` translation is needed the way a
 * `ContentForm` submit needs one.
 */
export async function saveSpinnerZonesAction(
  frameIndex: number,
  batch: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await contentService.saveSpinnerZones(frameIndex, batch);
  if (result.ok) {
    revalidateContent();
    return { ok: true };
  }
  return result;
}

/**
 * Adds one frame of the orbit to the hotel's key angles, so it can carry
 * zones (and so the guest's arrows stop on it). Same result shape as the
 * autosave above, for the same reason.
 */
export async function addSpinnerFrameAction(frameIndex: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await contentService.addSpinnerKeyAngle(frameIndex);
  if (result.ok) {
    revalidateContent();
    return { ok: true };
  }
  const error = result.error;
  return { ok: false, error: error.kind === 'rule' ? error.message : 'That frame could not be added.' };
}
