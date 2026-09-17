import type {
  CatalogEntryKind,
  DemoControlPort,
  HotelRepository,
  RoomSearchInterpreter,
  SpeechTranscriber,
} from '../domain/ports';
import type { Hotel } from '../domain/schemas';
import { getOpenAiKey } from '../infrastructure/cloudflare-env';
import { durableCatalogContentPort } from '../infrastructure/durable-catalog-content';
import { durableDemoControlPort, durableHotelRepository } from '../infrastructure/durable-hotel-repository';
import { keywordSearchInterpreter } from '../infrastructure/keyword-search-interpreter';
import { mediaLibraryPort } from '../infrastructure/media-library';
import { demoAddOns, demoHotel, demoHotels, demoPhysicalRooms, demoRates, demoRooms } from '../infrastructure/mock-data';
import { createBookingEngineAdapter, mockCrmAdapter, mockPaymentProvider, mockPmsAdapter } from '../infrastructure/mock-adapters';
import { createOpenAiSearchInterpreter } from '../infrastructure/openai-search-interpreter';
import { createOpenAiTranscriber } from '../infrastructure/openai-transcriber';
import { AssistantError, AssistantService } from './assistant-service';
import { BookingService } from './booking-service';
import { CatalogService } from './catalog-service';
import { ContentService } from './content-service';
import { InventoryService } from './inventory-service';
import { SampleBookingService } from './sample-bookings';

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

/** The demo tenant. A white-label deployment resolves this per host or per route. */
export const DEMO_HOTEL_SLUG = 'asteria-cove';

/**
 * Every hotel the admin's property switcher can actually switch to — real
 * seed data behind each one, not the decorative rows the switcher used to
 * show. The guest site stays pinned to `DEMO_HOTEL_SLUG`; only `/admin`
 * reads the switcher's current pick (see `hotel-context.ts`).
 */
export const availableHotels: Array<Pick<Hotel, 'slug' | 'name' | 'location'>> = demoHotels.map((hotel) => ({
  slug: hotel.slug,
  name: hotel.name,
  location: hotel.location,
}));

const bookingEngineAdapter = createBookingEngineAdapter(hotelRepository);

export const catalogService = new CatalogService(hotelRepository, bookingEngineAdapter);

export const inventoryService = new InventoryService(hotelRepository, demoControl, catalogService);

export const bookingService = new BookingService(
  hotelRepository,
  bookingEngineAdapter,
  mockPaymentProvider,
  mockCrmAdapter,
  mockPmsAdapter,
);

/** Fills an empty demo with sample stays; only ever run from the back office. */
export const sampleBookingService = new SampleBookingService(hotelRepository);

/** Which ids came from mock-data.ts — the only ones content-service refuses to hard-delete. */
const seedIds: Record<CatalogEntryKind, ReadonlySet<string>> = {
  hotel: new Set([demoHotel.id]),
  room: new Set(demoRooms.map((room) => room.id)),
  unit: new Set(demoPhysicalRooms.map((room) => room.id)),
  rate: new Set(demoRates.map((rate) => rate.id)),
  addon: new Set(demoAddOns.map((addOn) => addOn.id)),
};

export const contentService = new ContentService(
  hotelRepository,
  durableCatalogContentPort,
  mediaLibraryPort,
  DEMO_HOTEL_SLUG,
  seedIds,
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
