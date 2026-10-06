'use server';

import { requireBackOfficeSession } from '@/lib/application/admin-session';
import { headers } from 'next/headers';
import { z } from 'zod';
import { adminAssistantService, assistantInterpreterSource, catalogService, contentService, contentServiceFor, demoControl, hotelRepository, holidayRateAdvisor } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { holidayRateSuggestions, holidayRoomSignals, type HolidayRateReviewResult } from '@/lib/application/holiday-rate-insight';
import { hotelCountryCode, hotelToday, hotelWeekendDays } from '@/lib/application/holiday-rate-advisor';
import { buildRateRecommendations, type RateRecommendationResult } from '@/lib/application/rate-recommendations';
import { addIsoDays } from '@/lib/domain/dates';
import type { AdminApplyResult, AdminAskResult } from '@/lib/application/admin-assistant-service';
import { beginRequest, checkRateLimit, clientKeyFromHeaders, endRequest } from '@/lib/application/assistant-rate-limit';
import { MAX_UTTERANCE_LENGTH } from '@/lib/application/assistant-service';
import { addOnDraftSchema, adminDraftSchema, adminProposalSchema } from '@/lib/domain/admin-assistant';
import { revalidateContent } from '../content/_lib/revalidate';
import { notifyRateChange } from '@/lib/application/rate-change-notification';

/**
 * The admin assistant's two calls, as server actions rather than API routes
 * — the back office is server actions only (CLAUDE.md). Same guards as the
 * guest's `/api/assistant/search`: the per-isolate rate limit and the
 * one-in-flight lock, keyed the same way; and, as there, nothing here ever
 * logs the request text. The conversation's state (`draft`, `history`)
 * arrives from the browser with every message and is parsed, not trusted.
 */

const askSchema = z.object({
  utterance: z.string().max(MAX_UTTERANCE_LENGTH),
  draft: adminDraftSchema.nullable(),
  history: z.array(z.object({ role: z.enum(['admin', 'assistant']), text: z.string().max(MAX_UTTERANCE_LENGTH * 2) })).max(20),
});

export type AdminAskResponse =
  | { ok: true; result: AdminAskResult; interpretedBy: 'openai' | 'keyword' }
  | { ok: false; error: 'too_many_requests' | 'busy' | 'failed' };

export async function assistantMediaAction() {
  await requireBackOfficeSession();
  return contentService.listMedia();
}

/** Read-only, country-specific holiday signal. No room price changes here. */
export async function holidayRateAdviceAction(): Promise<HolidayRateReviewResult> {
  await requireBackOfficeSession();
  try {
    const selectedSlug = await getSelectedHotelSlug();
    const hotel = await catalogService.getHotel(selectedSlug);
    const advice = await holidayRateAdvisor.next(hotel, new Date());
    if (advice.status !== 'ready') return advice;

    const [rooms, units, bookings] = await Promise.all([
      hotelRepository.listRooms(hotel.id),
      hotelRepository.listPhysicalRooms(hotel.id),
      hotelRepository.listBookings({ hotelId: hotel.id }),
    ]);
    const content = contentServiceFor(selectedSlug);
    const inputs = await Promise.all(rooms.map(async (room) => {
      const [rates, override, availability] = await Promise.all([
        content.listRatesContent(room.id),
        demoControl.getRoomStatusOverride(room.id),
        hotelRepository.getAvailability(room.id, advice.date, addIsoDays(advice.date, 1)),
      ]);
      return {
        room, rates, override,
        capacity: units.filter((unit) => unit.roomTypeId === room.id).length,
        remaining: availability.find((night) => night.date === advice.date)?.remaining ?? null,
        confirmedBookings: bookings.filter((booking) => booking.status === 'confirmed' && booking.roomTypeId === room.id && booking.checkIn <= advice.date && advice.date < booking.checkOut).length,
      };
    }));
    return { ...advice, currency: hotel.currency, suggestions: holidayRateSuggestions(holidayRoomSignals(inputs)) };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Read-only, event-driven price review based on confirmed bookings. */
export async function rateRecommendationsAction(): Promise<RateRecommendationResult> {
  await requireBackOfficeSession();
  try {
    const selectedSlug = await getSelectedHotelSlug();
    const hotel = await catalogService.getHotel(selectedSlug);
    const now = new Date();
    const today = hotelToday(now, hotel.timezone);
    const [holiday, rooms, units, bookings] = await Promise.all([
      holidayRateAdvisor.allWithin(hotel, today, addIsoDays(today, 6), now),
      hotelRepository.listRooms(hotel.id),
      hotelRepository.listPhysicalRooms(hotel.id),
      hotelRepository.listBookings({ hotelId: hotel.id }),
    ]);
    const content = contentServiceFor(selectedSlug);
    const roomInputs = await Promise.all(rooms.map(async (room) => ({
      room,
      rates: await content.listRatesContent(room.id),
      override: await demoControl.getRoomStatusOverride(room.id),
      capacity: units.filter((unit) => unit.roomTypeId === room.id).length,
    })));
    return buildRateRecommendations({
      today, currency: hotel.currency, bookings, rooms: roomInputs,
      holidays: holiday.status === 'ready' ? holiday.holidays.map((day) => ({ date: day.date, name: day.holidayName })) : [],
      weekendDays: hotelWeekendDays(hotelCountryCode(hotel.location)),
    });
  } catch {
    return { status: 'unavailable' };
  }
}

export async function reviewAssistantAddOnAction(input: unknown): Promise<AdminAskResponse> {
  await requireBackOfficeSession();
  const parsed = addOnDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'failed' };
  return { ok: true, result: adminAssistantService.reviewAddOn(parsed.data), interpretedBy: 'keyword' };
}

export async function askAdminAssistantAction(input: unknown): Promise<AdminAskResponse> {
  await requireBackOfficeSession();
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'failed' };

  const clientKey = clientKeyFromHeaders(await headers());
  if (!checkRateLimit(clientKey, 'chat')) return { ok: false, error: 'too_many_requests' };
  if (!beginRequest(clientKey)) return { ok: false, error: 'busy' };
  try {
    const result = await adminAssistantService.ask(parsed.data);
    return { ok: true, result, interpretedBy: result.usedInterpreter ? assistantInterpreterSource() : 'keyword' };
  } catch (error) {
    console.error('Admin assistant: ask failed.', error instanceof Error ? error.message : error);
    return { ok: false, error: 'failed' };
  } finally {
    endRequest(clientKey);
  }
}

/**
 * The proposal comes back from the browser, so it is parsed, not trusted —
 * and it carries the version it was read at, so a change made in between
 * surfaces as a conflict exactly as it would from the admin form.
 */
export async function applyAdminProposalAction(proposal: unknown): Promise<AdminApplyResult> {
  await requireBackOfficeSession();
  const parsed = adminProposalSchema.safeParse(proposal);
  if (!parsed.success) return { ok: false, reason: 'validation', message: 'That proposal is not one this assistant made.' };

  const result = await adminAssistantService.apply(parsed.data);
  if (result.ok && parsed.data.kind === 'set_rate_price') {
    await notifyRateChange(parsed.data.roomTypeId, parsed.data.rateId, `Base price changed to ${parsed.data.to}`);
  }
  if (result.ok && parsed.data.kind !== 'navigate') revalidateContent();
  return result;
}
