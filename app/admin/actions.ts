'use server';

import { revalidatePath } from 'next/cache';
import { contentService, demoControl } from '@/lib/application/container';
import { roomStatusSchema } from '@/lib/domain/schemas';
import { z } from 'zod';

/**
 * Demo inventory controls. `setRoomStatus`/`resetDemoState` write to the
 * DemoControlPort only; a production admin writes through the PMS adapter
 * and never touches availability directly. The add-on on-sale switch lives
 * in `app/admin/content/add-ons/[id]/actions.ts` (`setAddOnOnSaleAction`)
 * instead — both the add-on's own page and the list here pass it into the
 * same `AddOnToggle`/`AddOnSaleToggle` components, so there is one save path
 * and one way to report a conflict, not two that could disagree.
 */

const overrideSchema = z.object({
  roomTypeId: z.string().min(1),
  status: z.union([roomStatusSchema, z.literal('auto')]),
});

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/admin/content');
  revalidatePath('/admin/rates');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/tape-chart');
  revalidatePath('/rooms');
  revalidatePath('/');
}

export async function setRoomStatus(input: z.infer<typeof overrideSchema>): Promise<void> {
  const parsed = overrideSchema.parse(input);
  await demoControl.setRoomStatusOverride(
    parsed.roomTypeId,
    parsed.status === 'auto' ? null : parsed.status,
  );
  refresh();
}

export async function resetDemoState(): Promise<void> {
  await demoControl.reset();
  await contentService.resetContent();
  refresh();
}
