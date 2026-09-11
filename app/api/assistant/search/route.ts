import { z } from 'zod';
import { AssistantError } from '@/lib/application/assistant-service';
import { beginRequest, checkRateLimit, clientKeyFor, endRequest } from '@/lib/application/assistant-rate-limit';
import { defaultRoomFilters, type RoomFilters } from '@/lib/application/catalog-service';
import { assistantInterpreterSource, assistantService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { defaultCriteria } from '@/lib/application/search-params';
import { roomCategories } from '@/lib/domain/room-attributes';
import { roomTypeSchema, stayCriteriaSchema } from '@/lib/domain/schemas';

/**
 * The guest's own words plus the stay/filters already in the URL — the
 * "current" the assistant adjusts rather than replaces. `utterance` may be
 * empty: that is how a removed result chip re-runs the search with no model
 * call (see `AssistantService.ask`).
 */
const assistantSearchBodySchema = z.object({
  utterance: z.string().max(400).default(''),
  checkIn: z.string().date().optional(),
  checkOut: z.string().date().optional(),
  adults: z.number().int().min(1).max(8).optional(),
  children: z.number().int().min(0).max(6).optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  views: z.array(roomTypeSchema.shape.view).optional(),
  bedTypes: z.array(roomTypeSchema.shape.bedType).optional(),
  categories: z.array(z.enum(roomCategories)).optional(),
  amenities: z.array(z.string()).optional(),
});

/** POST /api/assistant/search — an utterance, interpreted, sanitised, and priced through the real catalog. */
export async function POST(request: Request): Promise<Response> {
  const clientKey = `search:${clientKeyFor(request)}`;
  const correlationId = crypto.randomUUID();

  if (!checkRateLimit(clientKey)) {
    return Response.json(
      { error: 'rate_limited', message: 'Too many assistant requests. Wait a moment and try again.' },
      { status: 429 },
    );
  }
  if (!beginRequest(clientKey)) {
    return Response.json(
      { error: 'rate_limited', message: 'A search is already in progress for this session.' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = assistantSearchBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid_request', message: 'The assistant request is not valid.' },
        { status: 400 },
      );
    }
    const input = parsed.data;

    const base = defaultCriteria();
    const criteriaResult = stayCriteriaSchema.safeParse({
      checkIn: input.checkIn ?? base.checkIn,
      checkOut: input.checkOut ?? base.checkOut,
      adults: input.adults ?? base.adults,
      children: input.children ?? base.children,
    });
    if (!criteriaResult.success) {
      return Response.json(
        { error: 'invalid_request', message: 'Check-out must be after check-in.' },
        { status: 400 },
      );
    }

    const filters: RoomFilters = {
      ...defaultRoomFilters,
      minPrice: input.minPrice ?? defaultRoomFilters.minPrice,
      maxPrice: input.maxPrice ?? defaultRoomFilters.maxPrice,
      views: input.views ?? defaultRoomFilters.views,
      bedTypes: input.bedTypes ?? defaultRoomFilters.bedTypes,
      categories: input.categories ?? defaultRoomFilters.categories,
      amenities: input.amenities ?? defaultRoomFilters.amenities,
    };

    const result = await assistantService.ask({
      hotelSlug: DEMO_HOTEL_SLUG,
      utterance: input.utterance,
      criteria: criteriaResult.data,
      filters,
    });

    console.log('Assistant search', { correlationId, outcome: 'ok', offers: result.offers.length });
    return Response.json({
      ...result,
      interpretedBy: result.usedInterpreter ? assistantInterpreterSource() : null,
    });
  } catch (error) {
    if (error instanceof AssistantError) {
      const status = error.code === 'invalid_request' ? 400 : 503;
      console.error('Assistant search', { correlationId, outcome: error.code });
      return Response.json({ error: error.code, message: error.message }, { status });
    }
    console.error('Assistant search', { correlationId, outcome: 'internal_error' });
    return Response.json({ error: 'internal', message: 'Could not run that search.' }, { status: 500 });
  } finally {
    endRequest(clientKey);
  }
}
