import { assistantIntentJsonSchema, assistantIntentWireSchema, toSearchIntent } from '../domain/assistant';
import type { RoomSearchInterpreter } from '../domain/ports';
import type { CatalogFacets } from '../application/catalog-service';
import type { StayCriteria } from '../domain/schemas';

/**
 * Swappable in one place. `gpt-5.6-luna` is OpenAI's current cost-sensitive,
 * high-volume tier (the `gpt-4o-mini`-class slot this task calls for) and
 * supports Structured Outputs — verified against
 * developers.openai.com/api/docs/models at the time this was written, not
 * assumed from memory. Re-check before rolling this forward.
 */
export const ASSISTANT_MODEL = 'gpt-5.6-luna';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const MAX_OUTPUT_TOKENS = 600;

function systemPrompt(input: { today: string; current: StayCriteria; facets: CatalogFacets }): string {
  return [
    "You translate a hotel guest's spoken or typed request into a search filter for a room catalog.",
    'You never invent a room name, a price, or availability — you only ever produce a filter object; the application resolves it against the real, live catalog.',
    `Today's date is ${input.today} (ISO yyyy-mm-dd). Resolve relative dates ("next weekend", "in October") against it, and never resolve to a date before it.`,
    `The guest's stay currently has these dates and guests: ${JSON.stringify(input.current)}. Leave a criteria field null unless the utterance actually changes it — it is merged onto the existing stay, not a replacement for it.`,
    `The only views you may use: ${input.facets.views.join(', ') || '(none available)'}.`,
    `The only bed types you may use: ${input.facets.bedTypes.join(', ') || '(none available)'}.`,
    `The only room categories you may use: ${input.facets.categories.join(', ') || '(none available)'}.`,
    `The only amenities you may use, copied exactly as given, case included: ${input.facets.amenities.join(', ') || '(none available)'}.`,
    'Leave a filter field empty when the utterance does not mention it — an empty array or null is correct far more often than a guess.',
    'When part of the utterance names something the fields above cannot express (an amenity not in that list, a landmark, "close to the spa", a room number), put the exact phrase in `unresolved` instead of forcing it onto the nearest filter.',
    'Leave `addOnIds` empty: you are not given the add-on catalog, so any id you produced would be invented.',
  ].join('\n');
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export function createOpenAiSearchInterpreter(apiKey: string): RoomSearchInterpreter {
  return {
    async interpret(input) {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: ASSISTANT_MODEL,
          temperature: 0,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: [
            { role: 'system', content: systemPrompt(input) },
            { role: 'user', content: input.utterance },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'search_intent',
              strict: true,
              schema: assistantIntentJsonSchema(),
            },
          },
        }),
      });

      if (!response.ok) {
        // Body never logged: it may echo the utterance back. See TECH.md.
        throw new Error(`OpenAI interpreter request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('OpenAI interpreter returned no content.');
      }

      const wire = assistantIntentWireSchema.parse(JSON.parse(content));
      return toSearchIntent(wire);
    },
  };
}
