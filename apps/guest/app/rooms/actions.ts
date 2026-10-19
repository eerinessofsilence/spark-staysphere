'use server';

import { z } from 'zod';
import { stayCriteriaSchema } from '@/lib/domain/schemas';
import { getPublicRoomDetail } from '@/lib/application/catalog-api';
import { DEMO_HOTEL_SLUG } from '@/lib/application/guest-config';

const estimateSchema = z.object({ criteria: stayCriteriaSchema, roomSlug: z.string().min(1).max(200),
  addOnIds: z.array(z.string().max(100)).max(80) });

export async function quoteStay(input: { roomSlug: string; checkIn: string; checkOut: string; adults: number; children: number; addOnIds: string[] }) {
  const parsed = estimateSchema.safeParse({ criteria: input, roomSlug: input.roomSlug, addOnIds: input.addOnIds });
  if (!parsed.success) return { ok: false as const };
  try {
    const detail = await getPublicRoomDetail(DEMO_HOTEL_SLUG, parsed.data.roomSlug, parsed.data.criteria, parsed.data.addOnIds);
    return { ok: true as const, quote: detail.quote };
  } catch { return { ok: false as const }; }
}
