import type { ProductRecognizer } from '../domain/ports';
import { productGuessJsonSchema, productGuessSchema } from '../domain/product-recognition';
import { ASSISTANT_MODEL } from './openai-search-interpreter';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const MAX_OUTPUT_TOKENS = 300;

function systemPrompt(input: { hotelName: string; currency: string; existingNames: string[] }): string {
  return [
    `You identify a product or service in a photograph taken by the staff of ${input.hotelName}, so it can be sold to guests as an extra.`,
    'Name it the way a hotel menu or service list would: short, in English, no brand slogans. Describe it in one plain sentence a guest would read.',
    '`category` is "dining" for anything eaten or drunk, "service" for everything else (transfers, spa, equipment, tickets).',
    `Suggest a realistic price in ${input.currency} for a mid-to-upper-range hotel, or null if the photo gives nothing to go on. Pick "per_guest" for food, drink and per-person services, "per_night" for things used every night, "per_stay" otherwise.`,
    `These extras already exist — if the photo shows one of them, reuse its exact name: ${input.existingNames.join(', ') || '(none yet)'}.`,
    'If the picture shows no sellable product at all, set `recognized` to false and leave the other fields as best-effort placeholders.',
  ].join('\n');
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/** Vision through the same chat-completions call the assistants use, with the photo as an inline data URL. */
export function createOpenAiProductRecognizer(apiKey: string): ProductRecognizer {
  return {
    async recognize(input) {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: ASSISTANT_MODEL,
          temperature: 0,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: [
            { role: 'system', content: systemPrompt(input) },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'What is this, and how would the hotel list it?' },
                { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}`, detail: 'low' } },
              ],
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'product_guess', strict: true, schema: productGuessJsonSchema() },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI product recognizer request failed with status ${response.status}.`);
      }
      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('OpenAI product recognizer returned no content.');
      return productGuessSchema.parse(JSON.parse(content));
    },
  };
}
