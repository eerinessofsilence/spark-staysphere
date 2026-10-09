'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  clearAdminSession,
  getAdminSession,
  getAdminMember,
  INTEREST_ROUTES,
  isAdminInterest,
  signIn,
  writeAdminSession,
  type AdminInterest,
} from '@/lib/application/admin-session';
import { beginRequest, checkRateLimit, clientKeyFromHeaders, endRequest } from '@/lib/application/assistant-rate-limit';
import { teamService, tenantService } from '@/lib/application/container';
import { SELECTED_HOTEL_COOKIE } from '@/lib/application/hotel-context';
import { cookies } from 'next/headers';

/**
 * The back office's front door, as server actions rather than API routes
 * (CLAUDE.md: the back office is server actions only). Two steps: who you
 * are, then what you are here for. The session itself is `admin-session.ts`;
 * these only move a browser through it and out again.
 */

export interface SignInState {
  error: 'failed' | 'tooMany' | 'unavailable' | null;
}

export interface SignUpState { error: 'invalid' | 'duplicate' | 'tooMany' | 'unavailable' | null }
export interface CreateHotelState { error: 'invalid' | 'unavailable' | null }

const signInSchema = z.object({
  email: z.string().trim().email(),
  // Individual account passwords may legitimately start or end with spaces.
  password: z.string().min(1).max(128),
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
    let session: Awaited<ReturnType<typeof signIn>>;
    try {
      session = await signIn(parsed.data.email, parsed.data.password);
      // The legacy demo hint can be copied with a trailing newline; preserve
      // exact individual passwords and only retry the trimmed demo variant.
      if (!session && parsed.data.password !== parsed.data.password.trim()) {
        session = await signIn(parsed.data.email, parsed.data.password.trim());
      }
    } catch (error) {
      const requestId = crypto.randomUUID();
      console.error('Admin sign-in storage failure', { route: '/admin/sign-in', code: 'service_unavailable', requestId }, error);
      return { error: 'unavailable' };
    }
    if (!session) return { error: 'failed' };
    if (session.tenantAccount && !session.onboarded) redirect('/admin/onboarding');
    if (session.tenantAccount && session.onboarded && (await tenantService.listHotels(session.memberId)).length === 0) redirect('/admin/onboarding/create-hotel');
    const next = formData.get('next');
    if (next === 'select-hotel') redirect('/admin/onboarding/select-hotel');
    if (next === 'create-hotel') redirect('/admin/onboarding/create-hotel');
    if (session.onboarded) {
      const member = await getAdminMember();
      redirect(member?.role === 'Hotelier' ? '/admin/maintenance' : member?.role === 'Housekeeper' ? '/housekeeper' : '/admin');
    }
  } finally {
    endRequest(clientKey);
  }
  redirect('/admin/welcome');
}

export async function signUpAction(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(128) })
    .safeParse({ name: formData.get('name'), email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'invalid' };
  const clientKey = clientKeyFromHeaders(await headers());
  if (!checkRateLimit(clientKey, 'signIn') || !beginRequest(clientKey)) return { error: 'tooMany' };
  try {
    const result = await tenantService.register(parsed.data);
    if (!result.ok) return { error: result.error };
    const session = await signIn(parsed.data.email, parsed.data.password);
    if (!session) return { error: 'unavailable' };
  } catch (error) {
    console.error('Admin account registration failed', { route: '/admin/sign-up', code: 'service_unavailable', requestId: crypto.randomUUID() }, error);
    return { error: 'unavailable' };
  } finally {
    endRequest(clientKey);
  }
  redirect('/admin/onboarding/create-hotel');
}

export async function createHotelAction(_previous: CreateHotelState, formData: FormData): Promise<CreateHotelState> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in?next=create-hotel');
  const account = await tenantService.findAccount((await teamService.findMemberById(session.memberId))?.email ?? '');
  if (!account) redirect('/admin/onboarding');
  const parsed = z.object({ name: z.string().trim().min(2).max(120), location: z.string().trim().max(160), currency: z.enum(['EUR', 'USD', 'GBP']), timezone: z.string().trim().min(1).max(80), submissionKey: z.string().uuid() })
    .safeParse({ name: formData.get('name'), location: formData.get('location'), currency: formData.get('currency'), timezone: formData.get('timezone'), submissionKey: formData.get('submissionKey') });
  if (!parsed.success) return { error: 'invalid' };
  try {
    const result = await tenantService.createHotel({ ...parsed.data, ownerId: session.memberId });
    if (!result.ok) return { error: 'invalid' };
    await tenantService.markOnboarded(session.memberId);
    await writeAdminSession({ ...session, onboarded: true });
    const store = await cookies();
    store.set(SELECTED_HOTEL_COOKIE, result.hotel.slug, { path: '/admin', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 });
  } catch (error) {
    console.error('Draft hotel creation failed', { route: '/admin/onboarding/create-hotel', code: 'service_unavailable', requestId: crypto.randomUUID() }, error);
    return { error: 'unavailable' };
  }
  redirect('/admin');
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

  const member = await getAdminMember();
  if (member?.role === 'Hotelier') {
    await writeAdminSession({ ...session, interests: [], onboarded: true });
    redirect('/admin/maintenance');
  }

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
