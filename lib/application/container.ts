import type {
  AdminCommandInterpreter,
  CatalogEntryKind,
  DemoControlPort,
  HotelRepository,
  RoomSearchInterpreter,
  SpeechTranscriber,
} from '../domain/ports';
import type { Hotel } from '../domain/schemas';
import { getAdminAuthEnv, getMediaBucket, getOpenAiKey } from '../infrastructure/cloudflare-env';
import { durableCatalogContentPort } from '../infrastructure/durable-catalog-content';
import { durableDemoControlPort, durableHotelRepository } from '../infrastructure/durable-hotel-repository';
import { durableHousekeepingStore } from '../infrastructure/durable-housekeeping-store';
import { durableRoleStore } from '../infrastructure/durable-role-store';
import { durableSpinnerFrameStoragePort } from '../infrastructure/durable-spinner-frame-storage';
import { durableSpinnerMarkupPort } from '../infrastructure/durable-spinner-markup';
import { keywordAdminInterpreter } from '../infrastructure/keyword-admin-interpreter';
import { keywordSearchInterpreter } from '../infrastructure/keyword-search-interpreter';
import { mediaLibraryPort } from '../infrastructure/media-library';
import { readMockFrame } from '../infrastructure/spinner-frame-storage-mock';
import { demoAddOns, demoHotel, demoHotels, demoPhysicalRooms, demoRates, demoRooms } from '../infrastructure/mock-data';
import { createBookingEngineAdapter, mockCrmAdapter, mockPaymentProvider, mockPmsAdapter } from '../infrastructure/mock-adapters';
import { createOpenAiAdminInterpreter } from '../infrastructure/openai-admin-interpreter';
import { createOpenAiSearchInterpreter } from '../infrastructure/openai-search-interpreter';
import { createOpenAiTranscriber } from '../infrastructure/openai-transcriber';
import { AdminAssistantService } from './admin-assistant-service';
import { AssistantError, AssistantService } from './assistant-service';
import { BookingService } from './booking-service';
import { CatalogService } from './catalog-service';
import { ContentService } from './content-service';
import { systemClock } from '../domain/clock';
import { HousekeepingService } from './housekeeping-service';
import { InventoryService } from './inventory-service';
import { SampleBookingService } from './sample-bookings';
import { TeamService } from './team-service';

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

/** Custom roles and member role overrides — see `team-service.ts`. Its `hasPermission` is what `admin-session.ts`'s `requirePermission` actually calls. */
export const teamService = new TeamService(durableRoleStore);

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

export const catalogService = new CatalogService(hotelRepository, bookingEngineAdapter, durableSpinnerMarkupPort);

export const inventoryService = new InventoryService(hotelRepository, demoControl, catalogService);

/** Cleaning status per physical room — see `housekeeping-service.ts`; the store is D1 with an in-memory fallback like the others. */
export const housekeepingService = new HousekeepingService(
  durableHousekeepingStore,
  hotelRepository,
  catalogService,
  inventoryService,
  systemClock,
);

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
  durableSpinnerMarkupPort,
  durableSpinnerFrameStoragePort,
  DEMO_HOTEL_SLUG,
  seedIds,
  systemClock,
  // Imported lazily: admin-session.ts reads `adminAuthConfig` from this
  // module, so a static import here would be a cycle. Nothing runs until a
  // mutator is actually called, by which time both modules are long loaded.
  async (permission) => {
    const { requirePermission } = await import('./admin-session');
    await requirePermission(permission);
  },
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

/** The admin assistant's interpreter: the same key-at-call-time, keyword-fallback rule as the guest's. */
const adminCommandInterpreter: AdminCommandInterpreter = {
  async interpret(input) {
    const apiKey = getOpenAiKey();
    if (!apiKey) return keywordAdminInterpreter.interpret(input);
    try {
      return await createOpenAiAdminInterpreter(apiKey).interpret(input);
    } catch (error) {
      console.error('Admin assistant: OpenAI interpreter failed, falling back to keywords.', error);
      return keywordAdminInterpreter.interpret(input);
    }
  },
};

/**
 * Bound to the same hotel as `contentService`: a proposal must describe the
 * catalog `apply` will actually write to. See admin-assistant-service.ts.
 */
export const adminAssistantService = new AdminAssistantService(contentService, demoControl, adminCommandInterpreter);

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

/** What the demo signs in with when nothing is configured — and what the sign-in page prints in that case. */
export const DEMO_ADMIN_PASSWORD = 'staysphere';

/**
 * The back office's sign-in configuration, resolved at call time like every
 * other binding here. `demo` is true while the shared demo password is the
 * one in force, which is the only time the sign-in page may show it. The
 * session secret's development fallback is fixed on purpose: a cookie signed
 * during one `vinext dev` run must still verify after a restart, or every
 * restart would sign everyone out (and the e2e suite with them).
 */
export function adminAuthConfig(): { password: string; sessionSecret: string; demo: boolean } {
  const { password, sessionSecret } = getAdminAuthEnv();
  return {
    password: password ?? DEMO_ADMIN_PASSWORD,
    sessionSecret: sessionSecret ?? 'staysphere-development-session-secret',
    demo: password === null,
  };
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

/**
 * The one thing `app/media/[...path]/route.ts` needs from `lib/infrastructure`
 * — reading one object back out of the `MEDIA` bucket (or, without an R2
 * binding, the in-memory fallback spinner frame uploads write to) — wrapped
 * here so that route stays within the "container.ts is the only module that
 * may import lib/infrastructure" rule, same as every service above it.
 */
export async function readMediaObject(
  key: string,
): Promise<{ contentType: string; body: ReadableStream | ArrayBuffer } | null> {
  const bucket = getMediaBucket();
  if (bucket) {
    const object = await bucket.get(key);
    if (!object) return null;
    return { contentType: object.httpMetadata?.contentType ?? 'application/octet-stream', body: object.body };
  }
  const local = readMockFrame(key);
  return local ? { contentType: local.contentType, body: local.bytes } : null;
}
