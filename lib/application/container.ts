import type { DemoControlPort, HotelRepository } from '../domain/ports';
import { createBookingEngineAdapter, mockCrmAdapter, mockPaymentProvider, mockPmsAdapter } from '../infrastructure/mock-adapters';
import { durableDemoControlPort, durableHotelRepository } from '../infrastructure/durable-hotel-repository';
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

/** The demo tenant. A white-label deployment resolves this per host or per route. */
export const DEMO_HOTEL_SLUG = 'asteria-cove';
