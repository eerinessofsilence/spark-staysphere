/**
 * A per-isolate guard for the assistant routes: a sliding-window request
 * count per client, plus a one-request-in-flight lock so a guest cannot fire
 * a second search or transcription before the first has answered. Process-
 * local like the rest of the demo's in-memory state (see
 * `lib/infrastructure/mock-hotel-repository.ts`) — production needs a
 * KV/Redis-backed limiter shared across isolates, see TECH.md.
 */

const WINDOW_MS = 60_000;
/** A guest's search is one request; the admin chat is a request per answer, and a new room type is seven of them; sign-in is guessing a password. */
const MAX_REQUESTS_PER_WINDOW = { search: 8, chat: 30, signIn: 10, bookingLookup: 6 } as const;
export type RateLimitKind = keyof typeof MAX_REQUESTS_PER_WINDOW;

const requestLog = new Map<string, number[]>();
const inFlight = new Set<string>();

function pruneAndCount(clientKey: string, now: number): number[] {
  const timestamps = (requestLog.get(clientKey) ?? []).filter((at) => now - at < WINDOW_MS);
  requestLog.set(clientKey, timestamps);
  return timestamps;
}

/** True and records the attempt if the client is under its window limit. */
export function checkRateLimit(clientKey: string, kind: RateLimitKind = 'search'): boolean {
  const now = Date.now();
  const timestamps = pruneAndCount(`${kind}:${clientKey}`, now);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW[kind]) return false;
  timestamps.push(now);
  return true;
}

/** True and holds the lock if this client has no other assistant call in flight. */
export function beginRequest(clientKey: string): boolean {
  if (inFlight.has(clientKey)) return false;
  inFlight.add(clientKey);
  return true;
}

export function endRequest(clientKey: string): void {
  inFlight.delete(clientKey);
}

/** IP when the platform hands one over, otherwise one shared bucket — better than none. */
export function clientKeyFromHeaders(headers: Headers): string {
  return headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
}

export function clientKeyFor(request: Request): string {
  return clientKeyFromHeaders(request.headers);
}
