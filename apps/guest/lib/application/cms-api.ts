import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { hotelSchema, roomTypeSchema, physicalRoomSchema, addOnSchema, ratePlanSchema } from '@/lib/domain/schemas';
import { spinnerPolygonSchema } from '@/lib/domain/spinner-markup';

const baseZone = { id: z.string(), frameIndex: z.number().int(), polygon: spinnerPolygonSchema };
const zoneSchema = z.discriminatedUnion('kind', [
  z.object({ ...baseZone, kind: z.literal('unit'), roomSlug: z.string(), unitNumber: z.string(), floor: z.number(), href: z.string() }),
  z.object({ ...baseZone, kind: z.literal('roomType'), roomSlug: z.string(), href: z.string() }),
  z.object({ ...baseZone, kind: z.literal('floor'), floor: z.number(), facade: z.enum(['sea', 'town']).nullable(), roomNames: z.array(z.string()), href: z.string() }),
  z.object({ ...baseZone, kind: z.literal('link'), label: z.string(), description: z.string(), cta: z.string(), href: z.string() }),
]);
const catalogSchema = z.object({
  hotel: hotelSchema,
  rooms: z.array(roomTypeSchema.extend({ referencePrice: z.number().nonnegative().nullable() })),
  rates: z.array(ratePlanSchema),
  units: z.array(physicalRoomSchema), addOns: z.array(addOnSchema), zones: z.array(zoneSchema),
});
export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogRoom = Catalog['rooms'][number];

export function cmsOrigin() {
  const origin = (env as unknown as { CMS_API_URL?: string }).CMS_API_URL ?? process.env.CMS_API_URL ?? (process.env.NODE_ENV !== 'production' ? 'http://localhost:3101' : null);
  if (!origin) throw new Error('Configure CMS_API_URL.');
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid CMS_API_URL.');
  return url.origin;
}
export async function getCatalog(): Promise<Catalog> {
  const response = await fetch(`${cmsOrigin()}/api/public/catalog`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Hotel content is temporarily unavailable.');
  return catalogSchema.parse(await response.json());
}
