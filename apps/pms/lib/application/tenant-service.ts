import type { DraftHotel, TenantStore } from '../domain/tenant';
import { FREE_TRIAL_DAYS } from './subscription-service';

const encoder = new TextEncoder();
const ITERATIONS = 600_000;
const DAY_MS = 86_400_000;

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function passwordDigest(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERATIONS}$${base64(salt)}$${base64(await passwordDigest(password, salt, ITERATIONS))}`;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, rawIterations, rawSalt, rawDigest] = encoded.split('$');
  const iterations = Number(rawIterations);
  if (algorithm !== 'pbkdf2-sha256' || !Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !rawSalt || !rawDigest) return false;
  try {
    return sameBytes(await passwordDigest(password, fromBase64(rawSalt), iterations), fromBase64(rawDigest));
  } catch {
    return false;
  }
}

function slugPart(value: string): string {
  return value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46) || 'hotel';
}

export function createTenantService(store: TenantStore, clock = Date.now) {
  return {
    async register(input: { name: string; email: string; password: string }) {
      const name = input.name.trim();
      const email = input.email.trim().toLowerCase();
      if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.password.length < 12 || input.password.length > 128) return { ok: false as const, error: 'invalid' as const };
      const now = new Date(clock()).toISOString();
      const created = await store.createAccount({ id: `member-${crypto.randomUUID()}`, name, email, passwordHash: await hashPassword(input.password), createdAt: now });
      return created ? { ok: true as const } : { ok: false as const, error: 'duplicate' as const };
    },
    async authenticate(email: string, password: string) {
      const account = await store.findAccount(email.trim());
      if (!account || !(await verifyPassword(password, account.passwordHash))) return null;
      return { ...account, onboarded: account.onboarded === true || account.onboarded === 1 };
    },
    findAccount: (email: string) => store.findAccount(email.trim()),
    markOnboarded: (memberId: string) => store.markOnboarded(memberId),
    listHotels: (memberId: string) => store.listHotelsForMember(memberId),
    findHotel: (id: string) => store.findHotel(id),
    async createHotel(input: { ownerId: string; name: string; location: string; currency: DraftHotel['currency']; timezone: string; submissionKey: string }) {
      const name = input.name.trim();
      const location = input.location.trim();
      let timezoneIsValid = false;
      try {
        new Intl.DateTimeFormat('en', { timeZone: input.timezone });
        timezoneIsValid = true;
      } catch { /* A submitted timezone must be known to the runtime. */ }
      if (name.length < 2 || name.length > 120 || location.length > 160 || !timezoneIsValid || !['EUR', 'USD', 'GBP'].includes(input.currency) || !/^[0-9a-f-]{36}$/i.test(input.submissionKey)) return { ok: false as const, error: 'invalid' as const };
      const nowMs = clock();
      const createdAt = new Date(nowMs).toISOString();
      const hotel = await store.createHotel({
        id: `hotel-${crypto.randomUUID()}`,
        slug: `${slugPart(name)}-${crypto.randomUUID().slice(0, 8)}`,
        name, location, currency: input.currency, timezone: input.timezone,
        ownerId: input.ownerId, submissionKey: input.submissionKey,
        createdAt, trialEndsAt: new Date(nowMs + FREE_TRIAL_DAYS * DAY_MS).toISOString(),
      });
      return { ok: true as const, hotel };
    },
  };
}
