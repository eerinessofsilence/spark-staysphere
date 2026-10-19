import { z } from 'zod';
import { stayCriteriaSchema } from '@/lib/domain/schemas';
import { defaultRoomFilters } from '@/lib/application/guest-contracts';
import { DEMO_HOTEL_SLUG } from '@/lib/application/guest-config';
import { searchPublicRooms } from '@/lib/application/catalog-api';
import { buildQuery, parseCriteria, parseFilters } from '@/lib/application/search-params';
import { keywordSearchInterpreter } from '@/lib/application/keyword-search-interpreter';

const requestSchema = z.object({ utterance: z.string().max(400).default('') }).passthrough();

export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Invalid search.' }, { status: 400 });
  const { utterance, ...input } = parsed.data;
  const queryKeys: Record<string, string> = { views: 'view', bedTypes: 'bed', categories: 'category', amenities: 'amenity' };
  const params = Object.fromEntries(Object.entries(input).map(([key, value]) => [queryKeys[key] ?? key,
    Array.isArray(value) ? value.map(String) : String(value ?? '')]));
  const criteria = parseCriteria(params);
  const filters = parseFilters(params);
  try {
    const initial = await searchPublicRooms(DEMO_HOTEL_SLUG, criteria, defaultRoomFilters);
    const intent = await keywordSearchInterpreter.interpret({ utterance, today: new Date().toISOString().slice(0, 10), facets: initial.facets });
    const nextCriteria = stayCriteriaSchema.safeParse({ ...criteria, ...intent.criteria });
    if (!nextCriteria.success) return Response.json({ message: 'Invalid dates or party size.' }, { status: 400 });
    const nextFilters = { ...filters, ...intent.filters };
    const result = await searchPublicRooms(DEMO_HOTEL_SLUG, nextCriteria.data, nextFilters);
    return Response.json({ ...result, criteria: nextCriteria.data, filters: nextFilters, unresolved: intent.unresolved,
      query: buildQuery({ criteria: nextCriteria.data, filters: nextFilters }), relaxation: null,
      usedInterpreter: true, interpretedBy: 'keyword' });
  } catch (error) {
    console.error('CMS catalog search unavailable', error);
    return Response.json({ message: 'Catalog temporarily unavailable.' }, { status: 503 });
  }
}
