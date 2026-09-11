/**
 * A per-isolate guard for the assistant routes: a sliding-window request
 * count per client, plus a one-request-in-flight lock so a guest cannot fire
 * a second search or transcription before the first has answered. Process-
 * local like the rest of the demo's in-memory state (see
 * `lib/infrastructure/mock-hotel-repository.ts`) — production needs a
 * KV/Redis-backed limiter shared across isolates, see TECH.md.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

const requestLog = new Map<string, number[]>();
const inFlight = new Set<string>();

function pruneAndCount(clientKey: string, now: number): number[] {
  const timestamps = (requestLog.get(clientKey) ?? []).filter((at) => now - at < WINDOW_MS);
  requestLog.set(clientKey, timestamps);
  return timestamps;
}

/** True and records the attempt if the client is under its window limit. */
export function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const timestamps = pruneAndCount(clientKey, now);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
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
export function clientKeyFor(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  );
}
