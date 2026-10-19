import type { ContentError, ContentResult } from '@/lib/application/content-service';
import type { AdminT } from '@/lib/i18n/admin/translate';

/**
 * The shape every CMS form's `useActionState` reducer returns. A field error
 * renders beside its field; a conflict or a rule violation renders as the
 * shared banner (`ContentForm`) — see `formStateFromResult`.
 */
export interface ContentFormState {
  status: 'idle' | 'success' | 'error';
  message: string;
  fieldErrors?: Record<string, string[]>;
  /** The version now on the server — refreshes the form's version after a save or a conflict. */
  version?: number;
  /** Someone else saved first: the form offers to keep these edits or load theirs. */
  conflict?: boolean;
}

export const idleFormState: ContentFormState = { status: 'idle', message: '' };

/**
 * `t` (from `getAdminT()` in the server action) puts the three generic
 * messages below — validation, conflict, gone — in the team member's language;
 * without it they stay English. A `rule` error's own message comes from
 * `content-service.ts` and is English either way.
 */
export function formStateFromResult<T extends { version: number }>(
  result: ContentResult<T>,
  successMessage: string,
  t?: AdminT,
): ContentFormState {
  if (result.ok) return { status: 'success', message: successMessage, version: result.value.version };
  return formStateFromError(result.error, t);
}

export function formStateFromError(error: ContentError, t?: AdminT): ContentFormState {
  switch (error.kind) {
    case 'validation':
      return {
        status: 'error',
        message: t ? t('form.fixHighlighted') : 'Fix the highlighted fields and try again.',
        fieldErrors: error.fieldErrors,
      };
    case 'conflict':
      return {
        status: 'error',
        message: t
          ? t('form.conflict')
          : 'Someone else saved a newer version while you were editing. Your changes are still in the form.',
        version: error.currentVersion,
        conflict: true,
      };
    case 'not_found':
      return {
        status: 'error',
        message: t ? t('form.gone') : 'This no longer exists — it may have been removed or reset.',
      };
    case 'rule':
      return {
        status: 'error',
        message: error.message,
        fieldErrors: error.field ? { [error.field]: [error.message] } : undefined,
      };
    case 'forbidden':
      return { status: 'error', message: error.message };
  }
}

export function parseNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function parseOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Ordered-list editors serialize their state into one hidden JSON input. */
export function parseJsonList<T>(formData: FormData, name: string): T[] {
  const raw = formData.get(name);
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
