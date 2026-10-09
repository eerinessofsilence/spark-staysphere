import { cookies, headers as getRequestHeaders } from 'next/headers';
import { env } from 'cloudflare:workers';
import type { BookingConfirmation, DiningMenu, GuestConversation, TripSummary } from './guest-contracts';
import type { GuestSpinnerZone, FloorPlan, RoomDetail, RoomFilters, SearchResult } from './guest-contracts';
import type { Booking, Hotel, Quote, StayCriteria } from '../domain/schemas';

const CONFIRMATION_COOKIE_PREFIX = 'pms-booking-access-';

export class PmsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly currentTotal?: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'PmsApiError';
  }
}

function apiUrl(path: string): string {
  const binding = (env as Cloudflare.Env & { PMS_API_URL?: string }).PMS_API_URL;
  const configured = binding ?? process.env.PMS_API_URL;
  if (!configured && import.meta.env.PROD) {
    throw new Error('PMS_API_URL must be configured for deployed Guest environments.');
  }
  const base = (configured ?? 'http://localhost:3001').replace(/\/+$/, '');
  return `${base}${path}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, cache: 'no-store' });
  } catch (error) {
    console.error('PMS API connection failed', { path }, error);
    throw new PmsApiError('The hotel service is temporarily unavailable.', 503, 'unavailable');
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (response.ok && !payload) {
    throw new PmsApiError('The hotel service returned an invalid response.', 502, 'invalid_response');
  }
  if (!response.ok) {
    throw new PmsApiError(
      typeof payload?.message === 'string' ? payload.message : 'The hotel service is temporarily unavailable.',
      response.status,
      typeof payload?.error === 'string' ? payload.error : undefined,
      typeof payload?.currentTotal === 'number' ? payload.currentTotal : undefined,
      payload?.fieldErrors && typeof payload.fieldErrors === 'object'
        ? payload.fieldErrors as Record<string, string[]>
        : undefined,
    );
  }
  return payload as T;
}

export async function forwardPmsRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(apiUrl(path), { ...init, cache: 'no-store' });
  } catch (error) {
    console.error('PMS API connection failed', { path }, error);
    return Response.json({ error: 'unavailable', message: 'The hotel service is temporarily unavailable.' }, { status: 503 });
  }
}

async function post<T>(path: string, body: unknown, headers?: HeadersInit): Promise<T> {
  const outgoingHeaders = new Headers(headers);
  outgoingHeaders.set('content-type', 'application/json');
  const clientIp = (await getRequestHeaders()).get('cf-connecting-ip');
  if (clientIp) outgoingHeaders.set('cf-connecting-ip', clientIp);
  return request<T>(path, {
    method: 'POST',
    headers: outgoingHeaders,
    body: JSON.stringify(body),
  });
}

export async function getPublicHotel(hotelSlug: string): Promise<Hotel> {
  return (await post<{ hotel: Hotel }>('/api/public/catalog', { operation: 'hotel', hotelSlug })).hotel;
}

export async function getPublicDiningMenu(hotelSlug: string): Promise<DiningMenu> {
  return post<DiningMenu>('/api/public/catalog', { operation: 'dining-menu', hotelSlug });
}

export async function getPublicSpinnerZones(hotelSlug: string): Promise<GuestSpinnerZone[]> {
  return (await post<{ zones: GuestSpinnerZone[] }>('/api/public/catalog', { operation: 'spinner-zones', hotelSlug })).zones;
}

export async function searchPublicRooms(hotelSlug: string, criteria: StayCriteria, filters: RoomFilters): Promise<SearchResult> {
  return (await post<{ result: SearchResult }>('/api/public/catalog', {
    operation: 'search', hotelSlug, criteria, filters,
  })).result;
}

export async function getPublicRoomDetail(
  hotelSlug: string,
  roomSlug: string,
  criteria: StayCriteria,
  addOnIds: string[],
): Promise<RoomDetail> {
  return (await post<{ detail: RoomDetail }>('/api/public/catalog', {
    operation: 'room-detail', hotelSlug, roomSlug, criteria, addOnIds,
  })).detail;
}

export async function getPublicFloorPlan(
  hotelSlug: string,
  criteria: StayCriteria,
  filters: RoomFilters,
): Promise<FloorPlan> {
  return (await post<{ plan: FloorPlan }>('/api/public/catalog', {
    operation: 'floor-plan', hotelSlug, criteria, filters,
  })).plan;
}

export async function isPublicUnitAvailable(
  hotelSlug: string,
  roomTypeId: string,
  unitNumber: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  return (await post<{ available: boolean }>('/api/public/catalog', {
    operation: 'unit-availability', hotelSlug, roomTypeId, unitNumber, checkIn, checkOut,
  })).available;
}

export interface BookingInput {
  roomSlug: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addOnIds: string[];
}

export async function getPublicQuote(input: BookingInput): Promise<Quote> {
  return (await post<{ quote: Quote }>('/api/quotes', input)).quote;
}

export async function createPublicBooking(
  input: BookingInput & {
    guest: { firstName: string; lastName: string; email: string; phone: string };
    expectedTotal: number;
    paymentMethod: string;
    unitNumber?: string;
  },
  idempotencyKey: string,
): Promise<Booking> {
  const result = await post<{ booking: Booking; confirmationAccessToken: string }>(
    '/api/bookings', input, { 'Idempotency-Key': idempotencyKey },
  );
  await saveConfirmationAccess(result.booking.reference, result.confirmationAccessToken);
  return result.booking;
}

async function saveConfirmationAccess(reference: string, token: string): Promise<void> {
  const store = await cookies();
  store.set(`${CONFIRMATION_COOKIE_PREFIX}${reference}`, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getPublicBookingConfirmation(reference: string): Promise<BookingConfirmation> {
  const store = await cookies();
  const token = store.get(`${CONFIRMATION_COOKIE_PREFIX}${reference}`)?.value;
  if (!token) throw new PmsApiError('No booking found for that reference.', 404, 'not_found');
  return (await request<{ confirmation: BookingConfirmation }>(
    `/api/bookings/${encodeURIComponent(reference)}/confirmation`,
    { headers: { authorization: `Bearer ${token}` } },
  )).confirmation;
}

export async function getPublicGuestConversation(reference: string, email: string): Promise<GuestConversation | null> {
  const result = await post<{ conversation: GuestConversation | null }>('/api/public/conversations', { reference, email });
  return result.conversation;
}

export async function listPublicTrips(references: string[]): Promise<TripSummary[]> {
  const store = await cookies();
  const entries = references.flatMap((reference) => {
    const token = store.get(`${CONFIRMATION_COOKIE_PREFIX}${reference}`)?.value;
    return token ? [{ reference, token }] : [];
  });
  if (!entries.length) return [];
  return (await post<{ trips: TripSummary[] }>('/api/public/trips', { operation: 'list', entries })).trips;
}

export async function getPublicShowcaseTrips(): Promise<TripSummary[]> {
  const result = await request<{
    trips: TripSummary[];
    confirmationAccess: Array<{ reference: string; token: string }>;
  }>('/api/public/trips');
  await Promise.all(result.confirmationAccess.map(({ reference, token }) => saveConfirmationAccess(reference, token)));
  return result.trips;
}

export async function claimPublicTrip(reference: string, email: string): Promise<TripSummary | null> {
  try {
    const result = await post<{ trip: TripSummary; confirmationAccessToken: string }>(
      '/api/public/trips', { operation: 'claim', reference, email },
    );
    await saveConfirmationAccess(reference, result.confirmationAccessToken);
    return result.trip;
  } catch (error) {
    if (error instanceof PmsApiError && error.status === 404) return null;
    throw error;
  }
}

export async function cancelPublicTrip(reference: string, email: string): Promise<{
  outcome: 'cancelled' | 'already_cancelled' | 'stay_started' | 'not_found';
  trip?: TripSummary;
}> {
  return post('/api/public/trips', { operation: 'cancel', reference, email });
}
