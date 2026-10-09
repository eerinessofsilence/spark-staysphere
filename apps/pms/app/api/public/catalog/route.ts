import { z } from 'zod';
import { catalogService, contentServiceFor, inventoryService } from '@/lib/application/container';
import type { RoomFilters } from '@/lib/application/catalog-service';
import { roomCategories } from '@/lib/domain/room-attributes';
import { stayCriteriaSchema } from '@/lib/domain/schemas';

const roomFiltersSchema = z.object({
  minPrice: z.number().nonnegative().nullable(),
  maxPrice: z.number().nonnegative().nullable(),
  views: z.array(z.enum(['sea', 'garden', 'pool', 'city'])),
  bedTypes: z.array(z.enum(['king', 'twin', 'queen'])),
  categories: z.array(z.enum(roomCategories)),
  amenities: z.array(z.string()),
  minArea: z.number().nonnegative().nullable(),
  minFloor: z.number().int().nonnegative().nullable(),
  includeSoldOut: z.boolean(),
  sort: z.enum(['recommended', 'price_asc', 'price_desc', 'area_desc']),
});

const requestSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('hotel'), hotelSlug: z.string().min(1) }),
  z.object({ operation: z.literal('dining-menu'), hotelSlug: z.string().min(1) }),
  z.object({ operation: z.literal('spinner-zones'), hotelSlug: z.string().min(1) }),
  z.object({
    operation: z.literal('search'),
    hotelSlug: z.string().min(1),
    criteria: stayCriteriaSchema,
    filters: roomFiltersSchema,
  }),
  z.object({
    operation: z.literal('room-detail'),
    hotelSlug: z.string().min(1),
    roomSlug: z.string().min(1),
    criteria: stayCriteriaSchema,
    addOnIds: z.array(z.string()),
  }),
  z.object({
    operation: z.literal('floor-plan'),
    hotelSlug: z.string().min(1),
    criteria: stayCriteriaSchema,
    filters: roomFiltersSchema,
  }),
  z.object({
    operation: z.literal('unit-availability'),
    hotelSlug: z.string().min(1),
    roomTypeId: z.string().min(1),
    unitNumber: z.string().min(1),
    checkIn: z.string().date(),
    checkOut: z.string().date(),
  }).refine((value) => value.checkOut > value.checkIn, { path: ['checkOut'], message: 'Check-out must be after check-in.' }),
]);

/** Public, read-only catalog and availability operations consumed by Guest. */
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request', message: 'The catalog request is not valid.' }, { status: 400 });
  }

  try {
    const input = parsed.data;
    switch (input.operation) {
      case 'hotel':
        return Response.json({ hotel: await catalogService.getHotel(input.hotelSlug) });
      case 'dining-menu': {
        const content = contentServiceFor(input.hotelSlug);
        const [items, { hotel }] = await Promise.all([
          content.listAddOnsContent(),
          content.getHotelContent(),
        ]);
        return Response.json({
          hotel,
          items: items.filter((item) => item.enabled && item.category === 'dining'),
        });
      }
      case 'spinner-zones':
        return Response.json({ zones: await catalogService.getSpinnerZones(input.hotelSlug) });
      case 'search':
        return Response.json({
          result: await catalogService.search(input.hotelSlug, input.criteria, input.filters as RoomFilters),
        });
      case 'room-detail':
        return Response.json({
          detail: await catalogService.getRoomDetail(input.hotelSlug, input.roomSlug, input.criteria, input.addOnIds),
        });
      case 'floor-plan':
        return Response.json({
          plan: await inventoryService.getFloorPlan(input.hotelSlug, input.criteria, input.filters as RoomFilters),
        });
      case 'unit-availability':
        return Response.json({
          available: await inventoryService.isUnitFreeForStay(
            input.hotelSlug,
            input.roomTypeId,
            input.unitNumber,
            input.checkIn,
            input.checkOut,
          ),
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The catalog is temporarily unavailable.';
    const status = error instanceof Error && error.name.endsWith('NotFoundError') ? 404 : 503;
    if (status === 503) console.error('Public catalog request failed', error);
    return Response.json({ error: status === 404 ? 'not_found' : 'unavailable', message }, { status });
  }
}
