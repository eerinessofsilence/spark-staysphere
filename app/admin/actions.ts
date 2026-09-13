'use server';

import { revalidatePath } from 'next/cache';
import { contentService, demoControl } from '@/lib/application/container';
import { roomStatusSchema } from '@/lib/domain/schemas';
import { z } from 'zod';

/**
 * Demo inventory controls. `setRoomStatus`/`resetDemoState` write to the
 * DemoControlPort only; a production admin writes through the PMS adapter
 * and never touches availability directly. `setAddOnEnabled` writes through
 * `contentService` — the same path `/admin/content`'s add-on form uses, so
 * this quick switch and the CMS can never disagree about which value won.
 */

const overrideSchema = z.object({
  roomTypeId: z.string().min(1),
  status: z.union([roomStatusSchema, z.literal('auto')]),
});

const addOnSchema = z.object({ addOnId: z.string().min(1), enabled: z.boolean() });

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/admin/content');
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

export async function setAddOnEnabled(input: z.infer<typeof addOnSchema>): Promise<void> {
  const parsed = addOnSchema.parse(input);
  await contentService.setAddOnEnabled(parsed.addOnId, parsed.enabled);
  refresh();
}

export async function resetDemoState(): Promise<void> {
  await demoControl.reset();
  await contentService.resetContent();
  refresh();
}
