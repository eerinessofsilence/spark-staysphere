import { z } from "zod";
import { guestSchema, type Guest } from "./schemas";

export const MAX_GUEST_IMPORT_ROWS = 5000;
export const GUEST_IMPORT_BATCH_SIZE = 50;
export type GuestImportIssue = keyof Guest | "fileDuplicate";
export interface GuestImportRow {
  rowNumber: number;
  guest: Guest;
  issues: GuestImportIssue[];
}
export const guestImportResultSchema = z.object({
  results: z.array(
    z.object({
      rowNumber: z.number().int(),
      status: z.enum(["imported", "duplicate", "invalid", "failed"]),
    }),
  ),
});
export type GuestImportResult = z.infer<typeof guestImportResultSchema>["results"][number];

const aliases: Record<keyof Guest, string[]> = {
  firstName: ["firstname", "givenname", "имя", "vorname"],
  lastName: ["lastname", "surname", "familyname", "фамилия", "nachname"],
  email: ["email", "emailaddress", "электроннаяпочта", "почта"],
  phone: ["phone", "phonenumber", "telephone", "mobile", "телефон", "telefon"],
};

export function normalizeGuestImportRow(raw: Record<string, unknown>): Guest {
  const fields = new Map(
    Object.entries(raw).map(([key, value]) => [key.toLowerCase().replace(/[\s_-]+/g, ""), value]),
  );
  const value = (key: keyof Guest) => {
    const found = aliases[key]
      .map((alias) => fields.get(alias))
      .find((entry) => entry !== undefined);
    return typeof found === "string" || typeof found === "number" ? String(found).trim() : "";
  };
  return {
    firstName: value("firstName"),
    lastName: value("lastName"),
    email: value("email").toLowerCase(),
    phone: value("phone"),
  };
}

export function previewGuestImport(
  rows: { rowNumber: number; raw: Record<string, unknown> }[],
): GuestImportRow[] {
  const seen = new Set<string>();
  return rows.map(({ rowNumber, raw }) => {
    const guest = normalizeGuestImportRow(raw);
    const parsed = guestSchema.safeParse(guest);
    const issues: GuestImportIssue[] = parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.path[0] as keyof Guest);
    if (parsed.success) {
      if (seen.has(guest.email)) issues.push("fileDuplicate");
      seen.add(guest.email);
    }
    return { rowNumber, guest, issues: [...new Set(issues)] };
  });
}
