import { z } from 'zod';
import { addOnSchema } from './schemas';

/**
 * What a vision model may say about a photographed product, and nothing
 * more: a name, a one-line description, which counter it belongs to, and a
 * price guess the desk will check. The application turns it into an add-on
 * draft the team member confirms — the model never creates anything itself.
 */
export const productGuessSchema = z.object({
  /** `false` when the picture shows no sellable product the hotel could offer. */
  recognized: z.boolean(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300),
  category: addOnSchema.shape.category,
  /** Suggested price in the hotel's currency, or null when there is nothing to go on. */
  suggestedPrice: z.number().nonnegative().nullable(),
  pricingUnit: addOnSchema.shape.pricingUnit,
});

export type ProductGuess = z.infer<typeof productGuessSchema>;

/** The same shape as a strict JSON Schema for the model's structured output. */
export function productGuessJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['recognized', 'name', 'description', 'category', 'suggestedPrice', 'pricingUnit'],
    properties: {
      recognized: { type: 'boolean' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string', enum: ['service', 'dining'] },
      suggestedPrice: { type: ['number', 'null'] },
      pricingUnit: { type: 'string', enum: ['per_stay', 'per_night', 'per_guest'] },
    },
  };
}
