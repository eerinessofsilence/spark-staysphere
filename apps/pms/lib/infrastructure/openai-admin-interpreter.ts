import {
  adminCommandJsonSchema,
  adminCommandWireSchema,
  adminPages,
  roomTypeDraftFields,
  toAdminCommand,
  type AdminDraft,
} from '../domain/admin-assistant';
import type { AdminChatTurn, AdminCommandInterpreter, AdminCommandVocabulary } from '../domain/ports';
import { ASSISTANT_MODEL } from './openai-search-interpreter';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const MAX_OUTPUT_TOKENS = 400;
/** Enough context to answer "which floor?" — not the whole session. */
const HISTORY_TURNS = 10;

function draftContext(draft: AdminDraft | null): string[] {
  if (!draft) return [];
  if (draft.kind === 'create_room_type') {
    const missing = roomTypeDraftFields.filter((field) => draft.fields[field] === null);
    return [
      `The admin is in the middle of creating a room type. Fields given so far: ${JSON.stringify(draft.fields)}.`,
      `The assistant just asked for: ${missing[0] ?? 'nothing — everything is known'}. Read the reply as the answer to that question, plus any other room-type fields it happens to give, and return action \`create_room_type\` with those fields in \`roomType\` (only what this reply gives; the application already has the rest). A reply that is a bare name or a bare sentence is the answer, verbatim.`,
      'If the reply is instead a different request entirely, return that request as normal.',
    ];
  }
  if (draft.kind === 'create_physical_room') {
    return [
      `The admin is adding a room to the room type "${draft.roomTypeName}". The assistant just asked for the room number${draft.suggestedNumber ? `, suggesting ${draft.suggestedNumber}` : ''}.`,
      `Return action \`create_physical_room\` with the number in \`roomNumber\`; if the admin simply agrees ("yes", "ok", "that one"), use ${draft.suggestedNumber ? draft.suggestedNumber : 'null'}.`,
    ];
  }
  if (draft.kind === 'create_rate') return [`The admin is creating a rate. Fields given so far: ${JSON.stringify(draft.fields)}. Return action \`create_rate\` and fill only the rate fields stated in this reply.`];
  return [`The admin is creating an add-on. Fields given so far: ${JSON.stringify(draft.fields)}. Return action \`create_add_on\` and fill only the addOn fields stated in this reply. enabled is whether to put it on sale (true) or keep it hidden (false). Always return photos: null; photos are selected through a separate upload control. Never invent photo URLs.`];
}

function systemPrompt(vocabulary: AdminCommandVocabulary, draft: AdminDraft | null): string {
  return [
    "You translate a hotel team member's typed request into one command for the hotel's back office. This is a conversation: earlier messages are given for context.",
    'You only ever produce a command object; the application resolves it against the real catalog and shows the change for confirmation before anything is written. You never invent a room, a rate, a price the request did not state, or an availability.',
    'Actions: `set_rate_price` (the nightly price of a room type\'s rate), `set_room_hidden` (hide a room type from the site, or show it again — `hidden` true or false), `set_room_status` (override a room type\'s availability shown to guests: available, limited, last_room, sold_out, or `auto` to clear the override), `set_add_on_enabled` (put a service or dish on sale or take it off — `enabled` true or false), `create_room_type` (a new room type — fill `roomType` with whatever the request gives: name, a one-line description, floor number, size in m², how many guests it sleeps, bed type king/twin/queen, view sea/garden/pool/city; set `alsoRoom` true if a room for it was asked for too), `create_physical_room` (a numbered room under an existing room type — `target` is the type, `roomNumber` the number), `create_rate` (a new rate — fill `rate` with its room type name, name, nightly price, whether breakfast is included, and cancellation policy), `create_add_on` (a new service or dining item — fill `addOn` with name, description, service/dining category, price, and per_stay/per_night/per_guest unit), `navigate` (open one of the back-office screens), `unknown` (anything else).',
    `The only room types: ${vocabulary.roomTypes.join('; ') || '(none)'}. The only add-ons: ${vocabulary.addOns.join('; ') || '(none)'}. Put the one the request names in \`target\`, copied as the request said it — never invent one and never abbreviate to an id.`,
    `The only pages for \`navigate\`: ${adminPages.join(', ')}.`,
    'Fill only the fields the action needs and leave every other field null. A price is a plain number in the hotel\'s own currency. If the request names something these actions cannot do, use `unknown` and put the phrase in `unresolved`.',
    ...draftContext(draft),
  ].join('\n');
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/** Same REST call, model and strict Structured Outputs as `createOpenAiSearchInterpreter`. */
export function createOpenAiAdminInterpreter(apiKey: string): AdminCommandInterpreter {
  return {
    async interpret(input) {
      const history = input.history.slice(-HISTORY_TURNS).map((turn: AdminChatTurn) => ({
        role: turn.role === 'admin' ? 'user' : 'assistant',
        content: turn.text,
      }));

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
            { role: 'system', content: systemPrompt(input.vocabulary, input.draft) },
            ...history,
            { role: 'user', content: input.utterance },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'admin_command',
              strict: true,
              schema: adminCommandJsonSchema(),
            },
          },
        }),
      });

      if (!response.ok) {
        // Body never logged: it may echo the request back. See TECH.md.
        throw new Error(`OpenAI admin interpreter request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('OpenAI admin interpreter returned no content.');
      }

      return toAdminCommand(adminCommandWireSchema.parse(JSON.parse(content)));
    },
  };
}
