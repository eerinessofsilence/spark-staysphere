import type { HotelRepository } from "../domain/ports";
import { guestSchema, type Guest } from "../domain/schemas";
import { normalizeGuestImportRow, type GuestImportResult } from "../domain/guest-import";

/** Import is additive: never overwrite an existing guest or booking snapshot. */
export class GuestImportService {
  constructor(
    private readonly repository: Pick<
      HotelRepository,
      "listGuestProfiles" | "listBookings" | "createGuestProfile"
    >,
  ) {}

  async import(
    hotelId: string,
    rows: { rowNumber: number; guest: Guest }[],
  ): Promise<GuestImportResult[]> {
    const [profiles, bookings] = await Promise.all([
      this.repository.listGuestProfiles(hotelId),
      this.repository.listBookings(),
    ]);
    const existing = new Set(
      [
        ...profiles.map((profile) => profile.email),
        ...bookings
          .filter((booking) => booking.hotelId === hotelId)
          .map((booking) => booking.guest.email),
      ].map((email) => email.trim().toLowerCase()),
    );
    const results: GuestImportResult[] = [];
    for (const row of rows) {
      const parsed = guestSchema.safeParse(normalizeGuestImportRow(row.guest));
      if (!parsed.success) {
        results.push({ rowNumber: row.rowNumber, status: "invalid" });
        continue;
      }
      if (existing.has(parsed.data.email)) {
        results.push({ rowNumber: row.rowNumber, status: "duplicate" });
        continue;
      }
      try {
        await this.repository.createGuestProfile({
          id: crypto.randomUUID(),
          hotelId,
          ...parsed.data,
          createdAt: new Date().toISOString(),
        });
        existing.add(parsed.data.email);
        results.push({ rowNumber: row.rowNumber, status: "imported" });
      } catch {
        results.push({ rowNumber: row.rowNumber, status: "failed" });
      }
    }
    return results;
  }
}
