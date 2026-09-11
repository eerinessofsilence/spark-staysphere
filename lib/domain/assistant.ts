import { z } from 'zod';
import type { SearchIntent } from './ports';
import { roomCategories } from './room-attributes';
import { roomTypeSchema } from './schemas';

/**
 * Every enum the assistant may ever emit is one the catalog already owns —
 * reused from `roomTypeSchema` and `roomCategories` rather than restated, so
 * there is exactly one place that says what a "view" or a "category" is.
 */
const viewSchema = roomTypeSchema.shape.view;
const bedTypeSchema = roomTypeSchema.shape.bedType;
const categorySchema = z.enum(roomCategories);

/**
 * The wire contract for the OpenAI interpreter. Every field is required and
 * nullable rather than optional: OpenAI's strict Structured Outputs mode
 * requires every property to appear in `required`, so "the guest didn't say"
 * is spelled `null`, not a missing key. `keyword-search-interpreter.ts`
 * builds a `SearchIntent` directly and never touches this wire shape.
 */
export const assistantIntentWireSchema = z.object({
  criteria: z.object({
    checkIn: z.string().nullable(),
    checkOut: z.string().nullable(),
    adults: z.number().nullable(),
    children: z.number().nullable(),
  }),
  filters: z.object({
    minPrice: z.number().nullable(),
    maxPrice: z.number().nullable(),
    views: z.array(viewSchema),
    bedTypes: z.array(bedTypeSchema),
    categories: z.array(categorySchema),
    /** Free text: the real vocabulary is this hotel's own `facets.amenities`. */
    amenities: z.array(z.string()),
  }),
  addOnIds: z.array(z.string()),
  /** Phrases the model understood but that map to nothing the catalog can filter on. */
  unresolved: z.array(z.string()),
});

export type AssistantIntentWire = z.infer<typeof assistantIntentWireSchema>;

/**
 * The JSON Schema handed to OpenAI's `response_format`, derived from the
 * same Zod schema the response is parsed back through — one source for the
 * contract in both directions. `$schema` is stripped: OpenAI's schema object
 * accepts `type`/`properties`/`required`/`additionalProperties`, not a
 * meta-schema pointer.
 */
export function assistantIntentJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(assistantIntentWireSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** `null` (nothing said) becomes `undefined` (nothing to merge onto the stay). */
export function toSearchIntent(wire: AssistantIntentWire): SearchIntent {
  return {
    criteria: {
      ...(wire.criteria.checkIn !== null ? { checkIn: wire.criteria.checkIn } : {}),
      ...(wire.criteria.checkOut !== null ? { checkOut: wire.criteria.checkOut } : {}),
      ...(wire.criteria.adults !== null ? { adults: wire.criteria.adults } : {}),
      ...(wire.criteria.children !== null ? { children: wire.criteria.children } : {}),
    },
    filters: {
      ...(wire.filters.minPrice !== null ? { minPrice: wire.filters.minPrice } : {}),
      ...(wire.filters.maxPrice !== null ? { maxPrice: wire.filters.maxPrice } : {}),
      ...(wire.filters.views.length ? { views: wire.filters.views } : {}),
      ...(wire.filters.bedTypes.length ? { bedTypes: wire.filters.bedTypes } : {}),
      ...(wire.filters.categories.length ? { categories: wire.filters.categories } : {}),
      ...(wire.filters.amenities.length ? { amenities: wire.filters.amenities } : {}),
    },
    addOnIds: wire.addOnIds,
    unresolved: wire.unresolved,
  };
}
