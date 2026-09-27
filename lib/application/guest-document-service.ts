import {
  identityKey,
  identitySchema,
  documentImageType,
  MAX_DOCUMENT_BYTES,
  type GuestDocument,
  type GuestDocumentStore,
  type GuestIdentity,
  type PrivateDocumentStorage,
} from "@/lib/domain/guest-document";
import type { HotelRepository } from "@/lib/domain/ports";
import { guestSchema, type Booking, type Guest } from "@/lib/domain/schemas";
import { buildGuestDirectory } from "./guest-directory";

export class GuestDocumentService {
  constructor(
    private readonly repository: HotelRepository,
    private readonly store: GuestDocumentStore,
    private readonly storage: PrivateDocumentStorage,
  ) {}

  async searchGuests(hotelId: string, query: string) {
    const bookings = (await this.repository.listBookings()).filter((b) => b.hotelId === hotelId);
    const guests = buildGuestDirectory(bookings, await this.repository.listGuestProfiles(hotelId));
    const needle = query.trim().toLowerCase();
    return guests
      .filter((g) =>
        `${g.firstName} ${g.lastName} ${g.email} ${g.phone}`.toLowerCase().includes(needle),
      )
      .slice(0, 15);
  }

  async reviewGuest(
    hotelId: string,
    input: Guest,
    rawIdentity: GuestIdentity,
    existingGuestId?: string,
    distinctGuest = false,
  ) {
    const identity = identitySchema.parse(rawIdentity);
    const id = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const profiles = await this.repository.listGuestProfiles(hotelId);
    const directory = buildGuestDirectory(
      (await this.repository.listBookings()).filter((b) => b.hotelId === hotelId),
      profiles,
    );
    const documentIds = new Set(
      (await this.store.list(hotelId))
        .filter((d) => identityKey(d.identity) === identityKey(identity))
        .map((d) => d.guestId),
    );
    for (const p of profiles)
      if (p.identity && identityKey(p.identity) === identityKey(identity))
        documentIds.add(p.email.trim().toLowerCase());
    const matches = directory.filter((g) => g.id === id || documentIds.has(g.id));
    if (!existingGuestId && matches.length && (!distinctGuest || matches.some((g) => g.id === id)))
      return { kind: "matches" as const, matches };
    const selected = existingGuestId ? matches.find((g) => g.id === existingGuestId) : undefined;
    if (existingGuestId && !selected)
      throw new Error("Select a matching guest from this property.");
    const contact = selected
      ? {
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: selected.email,
          phone: selected.phone,
        }
      : guestSchema.parse(input);
    let profile = profiles.find(
      (p) => p.email.trim().toLowerCase() === contact.email.trim().toLowerCase(),
    );
    if (!profile)
      profile = await this.repository.createGuestProfile({
        ...contact,
        id: crypto.randomUUID(),
        hotelId,
        createdAt: new Date().toISOString(),
      });
    await this.repository.saveGuestIdentity(profile.id, hotelId, identity);
    return { kind: "confirmed" as const, guest: contact, identity };
  }

  async attach(booking: Booking, rawIdentity: GuestIdentity, bytes: ArrayBuffer): Promise<void> {
    const identity = identitySchema.parse(rawIdentity);
    const contentType = documentImageType(new Uint8Array(bytes));
    if (!contentType || !bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_BYTES)
      throw new Error("Use a JPEG or PNG up to 8 MB.");
    const currentBooking = await this.repository.getBookingByReference(booking.reference);
    if (
      !currentBooking ||
      currentBooking.hotelId !== booking.hotelId ||
      currentBooking.stayState === "checked_out"
    )
      throw new Error("This stay has already ended.");
    const id = booking.id;
    const existing = await this.store.get(booking.hotelId, id);
    if (existing?.status === "active") return; // Retry of a successful request.
    if (existing?.deletionReason) throw new Error("This document has been retired.");
    const document: GuestDocument = existing ?? {
      id,
      hotelId: booking.hotelId,
      guestId: booking.guest.email.trim().toLowerCase(),
      reservationId: booking.id,
      reservationReference: booking.reference,
      identity,
      objectKeys: [`documents/${booking.hotelId}/${id}/original`],
      contentType,
      status: "uploading",
      createdAt: new Date().toISOString(),
      deletedAt: null,
      deletionReason: null,
    };
    // Record before upload: even an interrupted or ambiguous PUT is discoverable by the deletion worker.
    await this.store.save(document);
    await this.storage.put(document.objectKeys[0], bytes, contentType);
    const latest = await this.repository.getBookingByReference(booking.reference);
    if (!latest || latest.stayState === "checked_out") {
      await this.deleteDocument(document);
      return;
    }
    await this.store.save({ ...document, status: "active" });
    // Covers a checkout racing the activation write. Reads also consult actual reservation state.
    if (
      (await this.repository.getBookingByReference(booking.reference))?.stayState === "checked_out"
    )
      await this.deleteDocument(document);
  }

  async listForGuest(hotelId: string, guestId: string) {
    await this.retryDeletions(hotelId);
    return (await this.store.list(hotelId))
      .filter((d) => d.guestId === guestId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Every document on file for the property, newest first — the `/admin/documents` grid, across guests. */
  async listAll(hotelId: string) {
    await this.retryDeletions(hotelId);
    return (await this.store.list(hotelId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async readImage(hotelId: string, id: string) {
    const document = await this.store.get(hotelId, id);
    if (!document || document.status !== "active") return null;
    const booking = await this.repository.getBookingByReference(document.reservationReference);
    if (
      !booking ||
      booking.hotelId !== hotelId ||
      booking.id !== document.reservationId ||
      booking.stayState === "checked_out"
    )
      return null;
    const object = await this.storage.get(document.objectKeys[0]);
    // Do not serve an image if checkout completed while storage was being read.
    if (
      (await this.repository.getBookingByReference(document.reservationReference))?.stayState ===
      "checked_out"
    )
      return null;
    return object;
  }

  private async deleteDocument(document: GuestDocument) {
    const pending: GuestDocument = {
      ...document,
      status: "pending_deletion",
      deletionReason: "reservation_checkout",
    };
    await this.store.save(pending);
    try {
      await this.storage.delete(document.objectKeys);
      await this.store.save({ ...pending, status: "deleted", deletedAt: document.deletedAt ?? new Date().toISOString() });
    } catch {
      /* Durable pending row is the retry queue. Never log the object or provider error. */
    }
  }

  /** Actual persisted checked_out state is also the durable outbox, including if the post-checkout hook crashed. */
  async retryDeletions(hotelId?: string) {
    const documents = await this.store.list(hotelId);
    for (const document of documents) {
      if (document.status === "deleted") {
        // An interrupted PUT can finish after its request died and after checkout.
        // Reapplying tombstones makes deletion convergent in that case too.
        try { await this.storage.delete(document.objectKeys); }
        catch { await this.store.save({ ...document, status: "pending_deletion" }); }
        continue;
      }
      const booking = await this.repository.getBookingByReference(document.reservationReference);
      if (document.deletionReason === "reservation_checkout" || (booking?.hotelId === document.hotelId && booking.stayState === "checked_out"))
        await this.deleteDocument(document);
    }
  }

  async afterCheckout(booking: Booking) {
    const documents = (await this.store.list(booking.hotelId)).filter(
      (d) => d.reservationId === booking.id && d.status !== "deleted",
    );
    for (const document of documents) await this.deleteDocument(document);
  }
}
