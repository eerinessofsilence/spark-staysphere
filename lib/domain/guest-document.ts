import { z } from "zod";

const date = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value),
    "Enter a valid date",
  );
export const identitySchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: date,
  nationality: z.string().trim().max(80),
  gender: z.enum(["", "M", "F", "X"]),
  documentNumber: z.string().trim().min(1).max(40),
  documentType: z.enum(["passport", "id"]),
  issueDate: date,
  expirationDate: date,
  issuingCountry: z.string().trim().min(2).max(80),
});
export type GuestIdentity = z.infer<typeof identitySchema>;
export const emptyIdentity: GuestIdentity = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  nationality: "",
  gender: "",
  documentNumber: "",
  documentType: "passport",
  issueDate: "",
  expirationDate: "",
  issuingCountry: "",
};
export type IdentityField = keyof GuestIdentity;
export interface DocumentRecognition {
  fields: GuestIdentity;
  confidence: Partial<Record<IdentityField, number>>;
}
/** The scanner depends on this port, never on an OCR vendor. Images remain in volatile memory. */
export interface DocumentOcrProvider {
  recognize(photo: Blob, signal?: AbortSignal): Promise<DocumentRecognition>;
}
export interface GuestDocument {
  id: string;
  hotelId: string;
  guestId: string; // Existing directory identity: normalized email within the property.
  reservationId: string;
  reservationReference: string;
  identity: GuestIdentity;
  objectKeys: string[]; // Original plus any derivatives; no public URLs.
  contentType: string;
  status: "uploading" | "active" | "pending_deletion" | "deleted";
  createdAt: string;
  deletedAt: string | null;
  deletionReason: "reservation_checkout" | null;
}
export interface GuestDocumentStore {
  get(hotelId: string, id: string): Promise<GuestDocument | null>;
  list(hotelId?: string): Promise<GuestDocument[]>;
  save(document: GuestDocument): Promise<void>;
}
export interface PrivateDocumentStorage {
  put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream | ArrayBuffer; contentType: string } | null>;
  delete(keys: string[]): Promise<void>;
}
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export function documentImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) return "image/png";
  return null;
}
export function identityKey(
  identity: Pick<GuestIdentity, "documentNumber" | "issuingCountry">,
): string {
  return `${identity.issuingCountry.replace(/\s/g, "").toUpperCase()}:${identity.documentNumber.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase()}`;
}
