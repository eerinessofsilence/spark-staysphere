import type { DemoControlPort, HotelRepository, RoomSearchInterpreter, SpeechTranscriber } from '../domain/ports';
import { getOpenAiKey } from '../infrastructure/cloudflare-env';
import { durableDemoControlPort, durableHotelRepository } from '../infrastructure/durable-hotel-repository';
import { keywordSearchInterpreter } from '../infrastructure/keyword-search-interpreter';
import { createBookingEngineAdapter, mockCrmAdapter, mockPaymentProvider, mockPmsAdapter } from '../infrastructure/mock-adapters';
import { createOpenAiSearchInterpreter } from '../infrastructure/openai-search-interpreter';
import { createOpenAiTranscriber } from '../infrastructure/openai-transcriber';
import { AssistantError, AssistantService } from './assistant-service';
import { BookingService } from './booking-service';
import { CatalogService } from './catalog-service';

/**
 * Composition root. This is the only module allowed to import `lib/infrastructure`.
 * Routes and components depend on the services below, so swapping the mock
 * implementations for HTTP adapters is a change to this file alone.
 *
 * `hotelRepository`/`demoControl` are durable: they persist bookings, payment
 * attempts, and admin overrides to D1 when `.openai/hosting.json` has a `d1`
 * binding configured, and fall back to the process-local in-memory store
 * otherwise. See lib/infrastructure/durable-hotel-repository.ts.
 */
export const hotelRepository: HotelRepository = durableHotelRepository;
export const demoControl: DemoControlPort = durableDemoControlPort;

const bookingEngineAdapter = createBookingEngineAdapter(hotelRepository);

export const catalogService = new CatalogService(hotelRepository, bookingEngineAdapter);

export const bookingService = new BookingService(
  hotelRepository,
  bookingEngineAdapter,
  mockPaymentProvider,
  mockCrmAdapter,
  mockPmsAdapter,
);

/**
 * Picks the OpenAI interpreter when a key resolves at call time — never
 * cached, for the same reason `getDemoDatabase` isn't — falling back to the
 * deterministic keyword interpreter otherwise, or if the OpenAI call itself
 * throws. Same shape as the D1-or-in-memory fallback in
 * durable-hotel-repository.ts, and the reason a keyless `npm run dev` and
 * `npm run test:e2e` still answer end to end.
 */
const roomSearchInterpreter: RoomSearchInterpreter = {
  async interpret(input) {
    const apiKey = getOpenAiKey();
    if (!apiKey) return keywordSearchInterpreter.interpret(input);
    try {
      return await createOpenAiSearchInterpreter(apiKey).interpret(input);
    } catch (error) {
      console.error('Assistant: OpenAI interpreter failed, falling back to keywords.', error);
      return keywordSearchInterpreter.interpret(input);
    }
  },
};

export const assistantService = new AssistantService(catalogService, roomSearchInterpreter);

/**
 * Which interpreter a call to `assistantService.ask` is about to use, so the
 * route can tell the panel to say, quietly, that it is matching on keywords.
 * Resolved at call time like the interpreter itself; the one gap is a key
 * that is configured but fails mid-request, which still answers via the
 * keyword fallback while this reports "openai" — acceptable for a demo.
 */
export function assistantInterpreterSource(): 'openai' | 'keyword' {
  return getOpenAiKey() ? 'openai' : 'keyword';
}

/**
 * No keyword fallback exists for speech — transcription needs OpenAI or it
 * needs nothing. Resolved at call time so the route can turn the absence
 * into a 503 rather than a crash.
 */
export const speechTranscriber: SpeechTranscriber = {
  transcribe(input) {
    const apiKey = getOpenAiKey();
    if (!apiKey) {
      throw new AssistantError(
        'transcription_unavailable',
        'Voice transcription needs an OpenAI key that this demo does not have configured.',
      );
    }
    return createOpenAiTranscriber(apiKey).transcribe(input);
  },
};

/** The demo tenant. A white-label deployment resolves this per host or per route. */
export const DEMO_HOTEL_SLUG = 'asteria-cove';
