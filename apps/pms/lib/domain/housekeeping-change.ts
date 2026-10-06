import { housekeepingStatusSchema, type HousekeepingStatus } from './schemas';

export type HousekeepingChangeError = 'invalidStatus' | 'photoRequired' | 'invalidPhoto';

/** Shared server-side rules; the tablet's file input is only a convenience. */
export function validateHousekeepingChange(status: unknown, photoData: string | null, assignedOnly: boolean):
  { ok: true; status: HousekeepingStatus } | { ok: false; error: HousekeepingChangeError } {
  const parsed = housekeepingStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: 'invalidStatus' };
  if (assignedOnly && !['dirty', 'in_progress', 'clean'].includes(parsed.data)) return { ok: false, error: 'invalidStatus' };
  if (parsed.data === 'clean' && !photoData) return { ok: false, error: 'photoRequired' };
  if (photoData && (photoData.length > 950_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photoData))) {
    return { ok: false, error: 'invalidPhoto' };
  }
  return { ok: true, status: parsed.data };
}
