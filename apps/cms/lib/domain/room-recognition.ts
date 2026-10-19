import { z } from 'zod';
import { roomTypeSchema } from './schemas';

/**
 * What a vision model may say about a photographed guest room, and nothing
 * more: what to call it, one sentence a guest would read, and the facts the
 * catalog asks for (size, sleeps, bed, view, a few amenities in shot). The
 * application turns it into a room-type draft the team member confirms —
 * the model never creates anything itself. Floor and rates are not in the
 * picture, so the draft asks for them.
 */
export const roomGuessSchema = z.object({
  /** `false` when the picture does not show a hotel room or suite. */
  recognized: z.boolean(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400),
  /** Estimated floor area in m², or null when the frame gives nothing to go on. */
  areaM2: z.number().positive().nullable(),
  capacity: z.number().int().min(1).max(8),
  bedType: roomTypeSchema.shape.bedType,
  view: roomTypeSchema.shape.view,
  amenities: z.array(z.string().trim().min(1).max(40)).max(8),
});

export type RoomGuess = z.infer<typeof roomGuessSchema>;

/** The same shape as a strict JSON Schema for the model's structured output. */
export function roomGuessJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['recognized', 'name', 'description', 'areaM2', 'capacity', 'bedType', 'view', 'amenities'],
    properties: {
      recognized: { type: 'boolean' },
      name: { type: 'string' },
      description: { type: 'string' },
      areaM2: { type: ['number', 'null'] },
      capacity: { type: 'integer' },
      bedType: { type: 'string', enum: ['king', 'queen', 'twin'] },
      view: { type: 'string', enum: ['sea', 'garden', 'pool', 'city'] },
      amenities: { type: 'array', items: { type: 'string' } },
    },
  };
}
