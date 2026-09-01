import type { DemoControlPort, HotelRepository } from '../domain/ports';
import {
  mockBookingEngineAdapter,
  mockCrmAdapter,
  mockPaymentProvider,
  mockPmsAdapter,
} from '../infrastructure/mock-adapters';
import {
  mockDemoControlPort,
  mockHotelRepository,
} from '../infrastructure/mock-hotel-repository';
import { BookingService } from './booking-service';
import { CatalogService } from './catalog-service';

/**
 * Composition root. This is the only module allowed to import `lib/infrastructure`.
 * Routes and components depend on the services below, so swapping the mock
 * implementations for HTTP adapters is a change to this file alone.
 */
export const hotelRepository: HotelRepository = mockHotelRepository;
export const demoControl: DemoControlPort = mockDemoControlPort;

export const catalogService = new CatalogService(hotelRepository, mockBookingEngineAdapter);

export const bookingService = new BookingService(
  hotelRepository,
  mockBookingEngineAdapter,
  mockPaymentProvider,
  mockCrmAdapter,
  mockPmsAdapter,
);

/** The demo tenant. A white-label deployment resolves this per host or per route. */
export const DEMO_HOTEL_SLUG = 'asteria-cove';
