import { beforeEach, describe, expect, it, vi } from 'vitest';

const { members, sessionSecret } = vi.hoisted(() => ({
  members: new Map<string, { id: string }>(),
  sessionSecret: 'unit-test-only-secret',
}));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })) }));
vi.mock('./container', () => ({
  adminAuthConfig: () => ({ sessionSecret, password: 'test-password' }),
  teamService: { findMemberById: (id: string) => Promise.resolve(members.get(id) ?? null) },
}));

import {
  createBookingConfirmationAccessToken,
  decodeSession,
  encodeSession,
  verifyBookingConfirmationAccessToken,
  type AdminSession,
} from './admin-session';

describe('signed admin and booking tokens', () => {
  beforeEach(() => {
    members.clear();
    members.set('member-1', { id: 'member-1' });
    vi.useRealTimers();
  });

  it('rejects missing, malformed, forged, expired, and unknown-member admin sessions', async () => {
    const session: AdminSession = { memberId: 'member-1', interests: [], onboarded: true, exp: Math.floor(Date.now() / 1000) + 60 };
    const valid = await encodeSession(session);
    const [payload, signature] = valid.split('.');
    const forged = `${payload}.${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;

    expect(await decodeSession(undefined)).toBeNull();
    expect(await decodeSession('not-a-token')).toBeNull();
    expect(await decodeSession(forged)).toBeNull();
    expect(await decodeSession(await encodeSession({ ...session, exp: Math.floor(Date.now() / 1000) - 1 }))).toBeNull();
    expect(await decodeSession(valid)).toMatchObject({ memberId: 'member-1' });

    members.delete('member-1');
    expect(await decodeSession(valid)).toBeNull();
  });

  it('accepts a booking token only for its signed reference and unexpired timestamp', async () => {
    const token = await createBookingConfirmationAccessToken('BOOK-123');
    expect(await verifyBookingConfirmationAccessToken('BOOK-123', token)).toBe(true);
    expect(await verifyBookingConfirmationAccessToken('BOOK-999', token)).toBe(false);
    expect(await verifyBookingConfirmationAccessToken('BOOK-123', undefined)).toBe(false);

    const [reference, expiry, signature] = token.split('.');
    expect(await verifyBookingConfirmationAccessToken('BOOK-123', `${reference}.${Number(expiry) - 1}.${signature}`)).toBe(false);
    expect(await verifyBookingConfirmationAccessToken('BOOK-123', `${reference}.${expiry}.forged`)).toBe(false);
    expect(await verifyBookingConfirmationAccessToken('BOOK-123', `OTHER.${expiry}.${signature}`)).toBe(false);
  });
});
