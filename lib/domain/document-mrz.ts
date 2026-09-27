import {
  emptyIdentity,
  type DocumentRecognition,
  type GuestIdentity,
  type IdentityField,
} from "./guest-document";

export function mrzCheckDigit(value: string): string {
  return String(
    [...value].reduce(
      (sum, char, i) =>
        sum +
        (char === "<" ? 0 : /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 55) *
          [7, 3, 1][i % 3],
      0,
    ) % 10,
  );
}
function dateFromMrz(value: string, birth: boolean): string {
  if (!/^\d{6}$/.test(value)) return "";
  let year = 2000 + Number(value.slice(0, 2));
  if (birth && year > new Date().getFullYear()) year -= 100;
  const result = `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  return !Number.isNaN(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result
    ? result
    : "";
}
/** ICAO TD1, TD2 and TD3. Unverified values remain editable and explicitly low-confidence. */
export function recognizeDocumentText(text: string, ocrConfidence = 0): DocumentRecognition {
  const fields = { ...emptyIdentity };
  const confidence: DocumentRecognition["confidence"] = {};
  const lines = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/\s/g, "").replace(/[«‹]/g, "<"));
  const put = (key: IdentityField, value: string, score = Math.min(ocrConfidence / 100, 0.7)) => {
    (fields as Record<string, string>)[key] = value;
    confidence[key] = value ? score : 0;
  };
  const checked = (key: IdentityField, raw: string, digit: string, value = raw.replace(/</g, "")) =>
    put(key, value, mrzCheckDigit(raw) === digit ? 0.98 : 0.3);
  const names = (raw: string) => {
    const [last, ...first] = raw.split("<<");
    put("lastName", last.replace(/</g, " ").trim());
    put("firstName", first.join(" ").replace(/</g, " ").trim());
  };
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1] ?? "";
    const c = lines[i + 2] ?? "";
    if (/^P[A-Z<][A-Z<]{3}/.test(a) && a.length === 44 && b.length === 44) {
      put("documentType", "passport", 0.98);
      put("issuingCountry", a.slice(2, 5));
      names(a.slice(5));
      checked("documentNumber", b.slice(0, 9), b[9]);
      put("nationality", b.slice(10, 13));
      checked("dateOfBirth", b.slice(13, 19), b[19], dateFromMrz(b.slice(13, 19), true));
      put("gender", /^[MFX]$/.test(b[20]) ? b[20] : "");
      checked("expirationDate", b.slice(21, 27), b[27], dateFromMrz(b.slice(21, 27), false));
      break;
    }
    if (/^[IAC][A-Z<][A-Z<]{3}/.test(a) && a.length === 30 && b.length === 30 && c.length === 30) {
      put("documentType", "id", 0.98);
      put("issuingCountry", a.slice(2, 5));
      names(c);
      checked("documentNumber", a.slice(5, 14), a[14]);
      checked("dateOfBirth", b.slice(0, 6), b[6], dateFromMrz(b.slice(0, 6), true));
      put("gender", /^[MFX]$/.test(b[7]) ? b[7] : "");
      checked("expirationDate", b.slice(8, 14), b[14], dateFromMrz(b.slice(8, 14), false));
      put("nationality", b.slice(15, 18));
      break;
    }
    if (/^[IAC][A-Z<][A-Z<]{3}/.test(a) && a.length === 36 && b.length === 36) {
      put("documentType", "id", 0.98);
      put("issuingCountry", a.slice(2, 5));
      names(a.slice(5));
      checked("documentNumber", b.slice(0, 9), b[9]);
      put("nationality", b.slice(10, 13));
      checked("dateOfBirth", b.slice(13, 19), b[19], dateFromMrz(b.slice(13, 19), true));
      put("gender", /^[MFX]$/.test(b[20]) ? b[20] : "");
      checked("expirationDate", b.slice(21, 27), b[27], dateFromMrz(b.slice(21, 27), false));
      break;
    }
  }
  // Printed English labels supplement MRZ (issue date is not present in standard MRZ).
  const labels: Partial<Record<IdentityField, string>> = {
    firstName: "(?:given names?|first name)",
    lastName: "(?:surname|last name)",
    documentNumber: "(?:passport|document|ID) (?:number|no\\.?)",
    nationality: "nationality",
    issuingCountry: "issuing country",
    dateOfBirth: "date of birth",
    issueDate: "(?:date of issue|issue date)",
    expirationDate: "(?:date of expiry|expiration date)",
  };
  for (const [key, label] of Object.entries(labels) as [keyof GuestIdentity, string][]) {
    if (fields[key]) continue;
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*[:\\n]\\s*([^\\n]+)`, "i"));
    if (!match) continue;
    const raw = match[1].trim();
    if (key.endsWith("Date") || key === "dateOfBirth") {
      const numeric = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
      const candidate = numeric ? `${numeric[3]}-${numeric[2]}-${numeric[1]}` : raw;
      if (/^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(candidate)))
        put(key, candidate, 0.5);
    } else put(key, raw, 0.5);
  }
  return { fields, confidence };
}
