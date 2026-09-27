import type { RoomRecognizer } from '../domain/ports';
import { roomGuessJsonSchema, roomGuessSchema } from '../domain/room-recognition';
import { ASSISTANT_MODEL } from './openai-search-interpreter';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const MAX_OUTPUT_TOKENS = 400;

function systemPrompt(input: { hotelName: string; existingNames: string[] }): string {
  return [
    `You describe a guest room in a photograph taken by the staff of ${input.hotelName}, so it can be listed as a room type on the hotel's own booking site.`,
    'Name it the way a hotel would ("Deluxe Sea View", "Garden Suite"): short, in English, no marketing slogans. Describe it in one or two plain sentences a guest would read.',
    'Estimate the floor area in m² from what is in frame, or null if you cannot tell. `capacity` is how many guests it sleeps, judged from the beds. `bedType` is "king" for one large bed, "queen" for one medium bed, "twin" for two separate beds. `view` is what a window shows — "sea", "garden", "pool" or "city"; when no window is visible, pick the most plausible.',
    'List up to eight amenities actually visible (balcony, desk, minibar, bathtub, sofa…), as short lowercase nouns.',
    `These room types already exist — if the photo clearly shows one of them, reuse its exact name: ${input.existingNames.join(', ') || '(none yet)'}.`,
    'If the picture does not show a hotel room or suite at all, set `recognized` to false and leave the other fields as best-effort placeholders.',
  ].join('\n');
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/** Vision through the same chat-completions call the product recognizer uses, with the photo as an inline data URL. */
export function createOpenAiRoomRecognizer(apiKey: string): RoomRecognizer {
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
                { type: 'text', text: 'What room is this, and how would the hotel list it?' },
                { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}`, detail: 'low' } },
              ],
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'room_guess', strict: true, schema: roomGuessJsonSchema() },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI room recognizer request failed with status ${response.status}.`);
      }
      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('OpenAI room recognizer returned no content.');
      return roomGuessSchema.parse(JSON.parse(content));
    },
  };
}
