import { z } from 'zod';

/**
 * A display DTO for a polygon drawn in the PMS spinner editor. PMS owns the
 * editor and storage; Guest receives zones through its public catalog API.
 * Only frames listed in `Hotel.spinner.keyAngles` may carry a zone because
 * the guest sees one only while the spinner is stopped on a key angle.
 */

/** What a zone sends a guest toward. */
export const spinnerZoneTargetSchema = z.discriminatedUnion('kind', [
  /** One physical room — the most specific target: opens straight to that door's floor plan pick. */
  z.object({ kind: z.literal('unit'), unitId: z.string().min(1) }),
  /** A storey, optionally narrowed to one facade — opens `/rooms` filtered to it. */
  z.object({ kind: z.literal('floor'), floor: z.number().int(), facade: z.enum(['sea', 'town']).nullable() }),
  /** A room type directly — opens its own room page, same as a flat-photo hotspot. */
  z.object({ kind: z.literal('roomType'), roomTypeId: z.string().min(1) }),
  /** Anything else worth pointing at (the pool, the spa) — a plain link, same shape as a flat-photo hotspot. */
  z.object({
    kind: z.literal('link'),
    label: z.string().min(1),
    description: z.string(),
    href: z.string().min(1),
    cta: z.string().min(1),
  }),
]);
export type SpinnerZoneTarget = z.infer<typeof spinnerZoneTargetSchema>;

const edgeCurveSchema = z.union([z.number(), z.tuple([z.number(), z.number()])]);

/**
 * A polygon exactly as `lib/domain/polygon` and the ported editor read it:
 * points as `[x, y]` fraction pairs, curves optional and one per side. Kept
 * loose here (no self-intersection/point-count check) — that belongs to
 * `checkPolygon` at the one place a batch is written, not to the shape a
 * zone is read back as.
 */
export const spinnerPolygonSchema = z.object({
  points: z.array(z.tuple([z.number(), z.number()])).min(3),
  curves: z.array(edgeCurveSchema).optional(),
});
export type SpinnerPolygon = z.infer<typeof spinnerPolygonSchema>;

export const spinnerZoneSchema = z.object({
  id: z.string(),
  hotelId: z.string(),
  /** Which of `Hotel.spinner.keyAngles` this zone is drawn on. */
  frameIndex: z.number().int().nonnegative(),
  polygon: spinnerPolygonSchema,
  /** `null` until a hotel team picks what the zone points to; never shown to a guest until then. */
  target: spinnerZoneTargetSchema.nullable(),
  updatedAt: z.string(),
});
export type SpinnerZone = z.infer<typeof spinnerZoneSchema>;

/**
 * Pulls a previously uploaded frame's `frameSetId` back out of a PMS media
 * URL. Static `/images/...` frames have no frame-set id.
 */
export function frameSetIdOf(url: string): string | null {
  return /\/media\/spinner\/[^/]+\/([^/]+)\//.exec(url)?.[1] ?? null;
}

/** One zone as the editor's autosave batch carries it — no `hotelId`/`updatedAt`, those are the store's job. */
export const spinnerZoneUpsertSchema = z.object({
  id: z.string(),
  frameIndex: z.number().int().nonnegative(),
  polygon: spinnerPolygonSchema,
  target: spinnerZoneTargetSchema.nullable(),
});
export type SpinnerZoneUpsert = z.infer<typeof spinnerZoneUpsertSchema>;
