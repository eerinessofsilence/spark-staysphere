'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { requirePermission, AdminPermissionError } from '@/lib/application/admin-session';
import { catalogService, ordersService } from '@/lib/application/container';
import { createHotelOrderInputSchema, orderStatusSchema } from '@/lib/domain/orders';
import { getAdminT } from '@/lib/i18n/admin/server';

const inputSchema = z.object({
  orderId: z.string().min(1),
  status: orderStatusSchema,
});

const createSchema = createHotelOrderInputSchema.extend({
  total: z.coerce.number().finite().nonnegative(),
  extras: z.coerce.number().int().nonnegative().max(99),
});

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((result, issue) => {
    const key = String(issue.path.at(-1) ?? 'form');
    result[key] = [...(result[key] ?? []), issue.message];
    return result;
  }, {});
}

export type OrderStatusActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type CreateOrderActionResult =
  | { ok: true; message: string; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createOrderAction(input: unknown): Promise<CreateOrderActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t('orders.createValidation'), fieldErrors: fieldErrors(parsed.error) };

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const order = await ordersService.create(hotel.id, { ...parsed.data, currency: hotel.currency });
  revalidatePath('/admin/orders');
  return { ok: true, message: t('orders.orderCreated', { id: order.id }), id: order.id };
}

export async function setOrderStatusAction(input: unknown): Promise<OrderStatusActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t('orders.invalidStatus') };

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const updated = await ordersService.setStatus(hotel.id, parsed.data.orderId, parsed.data.status);
  if (!updated) return { ok: false, message: t('orders.notFound') };

  revalidatePath('/admin/orders');
  return { ok: true, message: t('orders.statusSaved') };
}
