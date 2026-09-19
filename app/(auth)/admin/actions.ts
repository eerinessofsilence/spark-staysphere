'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  clearAdminSession,
  getAdminSession,
  INTEREST_ROUTES,
  isAdminInterest,
  signIn,
  writeAdminSession,
  type AdminInterest,
} from '@/lib/application/admin-session';
import { beginRequest, checkRateLimit, clientKeyFromHeaders, endRequest } from '@/lib/application/assistant-rate-limit';

/**
 * The back office's front door, as server actions rather than API routes
 * (CLAUDE.md: the back office is server actions only). Two steps: who you
 * are, then what you are here for. The session itself is `admin-session.ts`;
 * these only move a browser through it and out again.
 */

export interface SignInState {
  error: 'failed' | 'tooMany' | null;
}

const signInSchema = z.object({
  email: z.string().trim().email(),
  // Trimmed: a demo password copy-pasted from the sign-in page's own hint
  // sometimes carries a trailing newline or space, and there is no real
  // password here to protect by being strict about whitespace.
  password: z.string().trim().min(1),
});

/** Step one. A wrong address and a wrong password read the same — see `signIn`. */
export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'failed' };

  // The same per-isolate limiter the assistant uses, in its own bucket: a
  // password form is the one place on this site worth guessing at.
  const clientKey = clientKeyFromHeaders(await headers());
  if (!checkRateLimit(clientKey, 'signIn')) return { error: 'tooMany' };
  if (!beginRequest(clientKey)) return { error: 'tooMany' };
  try {
    const session = await signIn(parsed.data.email, parsed.data.password);
    if (!session) return { error: 'failed' };
  } finally {
    endRequest(clientKey);
  }
  redirect('/admin/welcome');
}

/** Only ever back into the back office — never an address a form could carry in from outside. */
function safeNext(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.startsWith('/admin') && !value.startsWith('//') ? value : null;
}

/**
 * Step two, and "skip" — both mark the session onboarded; skipping just
 * picks nothing. Lands on the first interest's screen, or wherever `next`
 * asked to go back to (the account page, when the interests are being
 * changed later), or the dashboard.
 */
export async function saveInterestsAction(formData: FormData): Promise<void> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');

  const picked = formData.getAll('interests').filter(isAdminInterest);
  // Same order as the picker, whatever order the boxes were ticked in.
  const interests: AdminInterest[] = (Object.keys(INTEREST_ROUTES) as AdminInterest[]).filter((interest) => picked.includes(interest));
  await writeAdminSession({ ...session, interests, onboarded: true });

  const next = safeNext(formData.get('next'));
  const first = interests[0];
  redirect(next ?? (first ? INTEREST_ROUTES[first] : '/admin'));
}

export async function signOutAction(): Promise<void> {
  await clearAdminSession();
  redirect('/admin/sign-in');
}
