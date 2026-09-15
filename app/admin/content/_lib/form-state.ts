import type { ContentError, ContentResult } from '@/lib/application/content-service';

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

export function formStateFromResult<T extends { version: number }>(
  result: ContentResult<T>,
  successMessage: string,
): ContentFormState {
  if (result.ok) return { status: 'success', message: successMessage, version: result.value.version };
  return formStateFromError(result.error);
}

export function formStateFromError(error: ContentError): ContentFormState {
  switch (error.kind) {
    case 'validation':
      return {
        status: 'error',
        message: 'Fix the highlighted fields and try again.',
        fieldErrors: error.fieldErrors,
      };
    case 'conflict':
      return {
        status: 'error',
        message: 'Someone else saved a newer version while you were editing. Your changes are still in the form.',
        version: error.currentVersion,
        conflict: true,
      };
    case 'not_found':
      return { status: 'error', message: 'This no longer exists — it may have been removed or reset.' };
    case 'rule':
      return {
        status: 'error',
        message: error.message,
        fieldErrors: error.field ? { [error.field]: [error.message] } : undefined,
      };
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
