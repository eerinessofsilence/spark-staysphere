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

const bulkStatusSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(1000),
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
  let order;
  try {
    order = await ordersService.create(hotel.id, { ...parsed.data, currency: hotel.currency });
  } catch (error) {
    if (error instanceof Error && error.message === 'ORDER_BOOKING_UNAVAILABLE') return { ok: false, message: t('orders.bookingUnavailable'), fieldErrors: { bookingReference: [t('orders.bookingUnavailable')] } };
    return { ok: false, message: t('orders.createValidation') };
  }
  revalidatePath('/admin/orders');
  if (order.bookingReference) revalidatePath(`/admin/bookings/${order.bookingReference}`);
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
  revalidatePath(`/admin/orders/${updated.id}`);
  return { ok: true, message: t('orders.statusSaved') };
}

export async function bulkSetOrderStatusAction(input: unknown): Promise<OrderStatusActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t('orders.invalidStatus') };

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const result = await ordersService.setStatuses(hotel.id, parsed.data.orderIds, parsed.data.status);
  if (result.updated) {
    revalidatePath('/admin/orders');
    for (const orderId of new Set(parsed.data.orderIds)) revalidatePath(`/admin/orders/${orderId}`);
  }
  if (result.missing) return { ok: false, message: t('orders.bulkPartial', { updated: result.updated, missing: result.missing }) };
  return { ok: true, message: t('orders.bulkSaved', { count: result.updated }) };
}

export async function updateOrderAction(orderId: string, input: unknown): Promise<CreateOrderActionResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const parsed = createSchema.omit({ status: true }).safeParse(input);
  if (!parsed.success) return { ok: false, message: t('orders.createValidation'), fieldErrors: fieldErrors(parsed.error) };
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const previous = (await ordersService.list(hotel.id)).find((order) => order.id === orderId);
  try {
    const updated = await ordersService.update(hotel.id, orderId, parsed.data);
    if (!updated) return { ok: false, message: t('orders.notFound') };
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${updated.id}`);
    for (const reference of new Set([previous?.bookingReference, updated.bookingReference])) {
      if (reference) revalidatePath(`/admin/bookings/${reference}`);
    }
    revalidatePath('/admin/accounting');
    revalidatePath('/admin/accounting/invoices');
    return { ok: true, id: updated.id, message: t('orders.saved') };
  } catch (error) {
    if (error instanceof Error && error.message === 'ORDER_NOT_EDITABLE') return { ok: false, message: t('orders.editOnlyNew') };
    return { ok: false, message: t(error instanceof Error && error.message === 'ORDER_BOOKING_UNAVAILABLE' ? 'orders.bookingUnavailable' : 'orders.createValidation') };
  }
}
