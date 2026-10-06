import { describe, expect, it, vi } from "vitest";
import { GuestImportService } from "./guest-import-service";
import { normalizeGuestImportRow, previewGuestImport } from "../domain/guest-import";
import { bookingSchema, type GuestProfile } from "../domain/schemas";

const guest = {
  firstName: "Ada",
  lastName: "Test",
  email: "ada@example.com",
  phone: "+1234567890",
};
const row = (email = guest.email, rowNumber = 2) => ({ rowNumber, guest: { ...guest, email } });
const profile = { ...guest, id: "profile", hotelId: "hotel", createdAt: "2026-09-30T00:00:00Z" };

describe("guest spreadsheet preview", () => {
  it("normalizes international headers, whitespace and email case", () => {
    expect(
      normalizeGuestImportRow({
        "First Name": " Ada ",
        last_name: " Test ",
        "E-mail": " ADA@EXAMPLE.COM ",
        Phone: " +1234567890 ",
      }),
    ).toEqual(guest);
    expect(
      normalizeGuestImportRow({
        Имя: "Ada",
        Фамилия: "Test",
        Почта: guest.email,
        Телефон: guest.phone,
      }),
    ).toEqual(guest);
    expect(
      normalizeGuestImportRow({
        Vorname: "Ada",
        Nachname: "Test",
        "E-Mail": guest.email,
        Telefon: guest.phone,
      }),
    ).toEqual(guest);
  });
  it("preserves source row numbers and flags invalid and duplicate rows", () => {
    const preview = previewGuestImport([
      { rowNumber: 2, raw: guest },
      { rowNumber: 4, raw: { ...guest, email: "ADA@example.com" } },
      { rowNumber: 5, raw: { ...guest, email: "broken", phone: "123", firstName: "" } },
    ]);
    expect(preview[0].issues).toEqual([]);
    expect(preview[1]).toMatchObject({ rowNumber: 4, issues: ["fileDuplicate"] });
    expect(preview[2].issues).toEqual(expect.arrayContaining(["email", "phone", "firstName"]));
  });
  it("does not let an invalid first row block a later valid row with the same email", () => {
    expect(
      previewGuestImport([
        { rowNumber: 2, raw: { ...guest, phone: "" } },
        { rowNumber: 3, raw: guest },
      ])[1].issues,
    ).toEqual([]);
  });
});

describe("guest import service", () => {
  function repository(profiles: GuestProfile[] = []) {
    return {
      listGuestProfiles: vi.fn(async () => profiles),
      listBookings: vi.fn(async () => []),
      createGuestProfile: vi.fn(async (value: GuestProfile) => {
        profiles.push(value);
        return value;
      }),
    };
  }
  it("saves selected rows, normalizes values and skips duplicates on retry", async () => {
    const repo = repository();
    const service = new GuestImportService(repo);
    expect(
      await service.import("hotel", [row(" ADA@EXAMPLE.COM "), row("ada@example.com", 3)]),
    ).toEqual([
      { rowNumber: 2, status: "imported" },
      { rowNumber: 3, status: "duplicate" },
    ]);
    expect(repo.createGuestProfile).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ ...guest, hotelId: "hotel" }),
    );
    expect(await service.import("hotel", [row()])).toEqual([{ rowNumber: 2, status: "duplicate" }]);
  });
  it("does not overwrite existing profiles", async () => {
    const repo = repository([profile]);
    expect(await new GuestImportService(repo).import("hotel", [row()])).toEqual([
      { rowNumber: 2, status: "duplicate" },
    ]);
    expect(repo.createGuestProfile).not.toHaveBeenCalled();
  });
  it("recognizes booking-only guests in the target property but not other properties", async () => {
    const booking = bookingSchema.parse({
      id: "b",
      reference: "ABC123",
      idempotencyKey: "import-test",
      hotelId: "hotel",
      roomTypeId: "r",
      ratePlanId: "rate",
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
      adults: 1,
      children: 0,
      guest,
      addOnIds: [],
      total: 100,
      currency: "EUR",
      status: "confirmed",
      createdAt: profile.createdAt,
    });
    const repo = { ...repository(), listBookings: vi.fn(async () => [booking]) };
    const service = new GuestImportService(repo);
    expect((await service.import("hotel", [row()]))[0].status).toBe("duplicate");
    expect((await service.import("other-hotel", [row()]))[0].status).toBe("imported");
  });
  it("validates server-side and reports individual storage failures without losing later rows", async () => {
    const repo = repository();
    repo.createGuestProfile.mockRejectedValueOnce(new Error("database unavailable"));
    const rows = [row("broken"), row("failed@example.com", 3), row("valid@example.com", 4)];
    expect(await new GuestImportService(repo).import("hotel", rows)).toEqual([
      { rowNumber: 2, status: "invalid" },
      { rowNumber: 3, status: "failed" },
      { rowNumber: 4, status: "imported" },
    ]);
  });
});
