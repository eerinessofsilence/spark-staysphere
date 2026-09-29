import type { HotelRepository } from '../domain/ports';
import { emailAutomationsService } from './container';
import { toIsoDate } from './search-params';

/**
 * Shared by `/api/internal/scheduled-automations` (Vercel's own daily cron,
 * `vercel.json`) and the Cloudflare Worker's `scheduled()` (`worker.ts`,
 * ticking every ten minutes per `vite.config.ts`'s `triggers.crons`) — one
 * place computing "today" and handing every booking to
 * `EmailAutomationsService.sendScheduled`, so the two hosts can't drift.
 */
export async function runScheduledAutomations(hotelRepository: HotelRepository): Promise<number> {
  const bookings = await hotelRepository.listBookings();
  const today = toIsoDate(new Date());
  return emailAutomationsService.sendScheduled(bookings, today);
}
