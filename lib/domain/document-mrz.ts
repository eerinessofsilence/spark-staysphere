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
// OCR commonly confuses letters and digits. Correct only positions whose MRZ
// format is numeric; never replace an O/I/B inside a guest's name or number.
function mrzDigits(value: string): string {
  return value.replace(/[OQ]/g, "0").replace(/[IL]/g, "1").replace(/Z/g, "2")
    .replace(/S/g, "5").replace(/G/g, "6").replace(/B/g, "8");
}

function mrzCountry(value: string): string {
  return value.replace(/0/g, "O").replace(/1/g, "I").replace(/8/g, "B");
}

function isDateLine(line: string, td1 = false): boolean {
  const birth = mrzDigits(td1 ? line.slice(0, 6) : line.slice(13, 19));
  const expiry = mrzDigits(td1 ? line.slice(8, 14) : line.slice(21, 27));
  const country = mrzCountry(td1 ? line.slice(15, 18) : line.slice(10, 13));
  return /^[A-Z<]{3}$/.test(country) && !!dateFromMrz(birth, true) && !!dateFromMrz(expiry, false);
}

/** ICAO TD1, TD2 and TD3. Read available fields even when trailing fillers are clipped. */
export function recognizeDocumentText(text: string, ocrConfidence = 0): DocumentRecognition {
  const fields = { ...emptyIdentity };
  const confidence: DocumentRecognition["confidence"] = {};
  const lines = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[«‹〈＜»›〉>]/g, "<").replace(/[^A-Z0-9<]/g, ""))
    .filter(Boolean);
  const put = (key: IdentityField, value: string, score = Math.min(ocrConfidence / 100, 0.7)) => {
    (fields as Record<string, string>)[key] = value;
    confidence[key] = value ? score : 0;
  };
  const checked = (key: IdentityField, raw: string, digit: string, value = raw.replace(/</g, "")) =>
    put(key, value, mrzCheckDigit(raw) === mrzDigits(digit) ? 0.98 : 0.3);
  const names = (raw: string) => {
    const [last, ...first] = raw.split("<<");
    const readName = (key: 'firstName' | 'lastName', value: string) => {
      const name = value.replace(/<{2}.*$/, '').replace(/</g, " ").replace(/\s+/g, " ").trim();
      // A long repeated-letter tail is a misread filler run, not a reliable
      // name. Keep it reviewable, but prefer a readable printed name/pass.
      put(key, name, /([A-Z])\1{3,}/.test(name) ? 0.3 : Math.min(ocrConfidence / 100, 0.7));
    };
    readName("lastName", last);
    readName("firstName", first.join("<<"));
  };
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1] ?? "";
    const c = lines[i + 2] ?? "";
    if (/^P[A-Z<][A-Z0-9<]{3}[A-Z<]+<<[A-Z<]/.test(a)) {
      put("documentType", "passport", 0.98);
      put("issuingCountry", mrzCountry(a.slice(2, 5)));
      names(a.slice(5, 44));
      // Sparse-text OCR can put a blank or unrelated line between MRZ rows.
      const data = [b, c].find((line) => line.length >= 28 && isDateLine(line));
      if (!data) continue;
      checked("documentNumber", data.slice(0, 9), data[9]);
      put("nationality", mrzCountry(data.slice(10, 13)));
      const birth = mrzDigits(data.slice(13, 19));
      const expiry = mrzDigits(data.slice(21, 27));
      checked("dateOfBirth", birth, data[19], dateFromMrz(birth, true));
      put("gender", /^[MFX]$/.test(data[20]) ? data[20] : "");
      checked("expirationDate", expiry, data[27], dateFromMrz(expiry, false));
      break;
    }
    if (/^[IAC][A-Z<][A-Z0-9<]{3}/.test(a) && a.length >= 15 && a.length <= 30 &&
        b.length >= 18 && b.length <= 30 && isDateLine(b, true) && /^[A-Z<]+<<[A-Z<]/.test(c)) {
      put("documentType", "id", 0.98);
      put("issuingCountry", mrzCountry(a.slice(2, 5)));
      names(c.slice(0, 30));
      checked("documentNumber", a.slice(5, 14), a[14]);
      const birth = mrzDigits(b.slice(0, 6));
      const expiry = mrzDigits(b.slice(8, 14));
      checked("dateOfBirth", birth, b[6], dateFromMrz(birth, true));
      put("gender", /^[MFX]$/.test(b[7]) ? b[7] : "");
      checked("expirationDate", expiry, b[14], dateFromMrz(expiry, false));
      put("nationality", mrzCountry(b.slice(15, 18)));
      break;
    }
    if (/^[IAC][A-Z<][A-Z0-9<]{3}[A-Z<]+<<[A-Z<]/.test(a) && b.length >= 28 && isDateLine(b)) {
      put("documentType", "id", 0.98);
      put("issuingCountry", mrzCountry(a.slice(2, 5)));
      names(a.slice(5, 36));
      checked("documentNumber", b.slice(0, 9), b[9]);
      put("nationality", mrzCountry(b.slice(10, 13)));
      const birth = mrzDigits(b.slice(13, 19));
      const expiry = mrzDigits(b.slice(21, 27));
      checked("dateOfBirth", birth, b[19], dateFromMrz(birth, true));
      put("gender", /^[MFX]$/.test(b[20]) ? b[20] : "");
      checked("expirationDate", expiry, b[27], dateFromMrz(expiry, false));
      break;
    }
  }
  // A second OCR pass can recover only the numeric passport/TD2 row. It is
  // useful on its own, but needs two valid check digits to avoid reading an
  // unrelated printed line as MRZ. Issuing country and names stay unknown.
  if (!fields.documentNumber) {
    const data = lines.find((line) => {
      if (line.length < 28 || !isDateLine(line)) return false;
      return [
        [line.slice(0, 9), line[9]],
        [mrzDigits(line.slice(13, 19)), line[19]],
        [mrzDigits(line.slice(21, 27)), line[27]],
      ].filter(([value, digit]) => mrzCheckDigit(value) === mrzDigits(digit)).length >= 2;
    });
    if (data) {
      checked("documentNumber", data.slice(0, 9), data[9]);
      put("nationality", mrzCountry(data.slice(10, 13)));
      const birth = mrzDigits(data.slice(13, 19));
      const expiry = mrzDigits(data.slice(21, 27));
      checked("dateOfBirth", birth, data[19], dateFromMrz(birth, true));
      put("gender", /^[MFX]$/.test(data[20]) ? data[20] : "");
      checked("expirationDate", expiry, data[27], dateFromMrz(expiry, false));
    }
  }
  // Printed English labels supplement MRZ (issue date is not present in standard MRZ).
  const labels: Partial<Record<IdentityField, string>> = {
    firstName: "(?:given names?|first names?|name)",
    lastName: "(?:surname|last name)",
    documentNumber: "(?:passport|document|ID) (?:number|no\\.?)",
    nationality: "nationality",
    issuingCountry: "issuing country",
    dateOfBirth: "date of birth",
    issueDate: "(?:date of issue|issue date)",
    expirationDate: "(?:date of expiry|date of expiration|expiration date)",
  };
  for (const [key, label] of Object.entries(labels) as [keyof GuestIdentity, string][]) {
    if (fields[key] && (confidence[key] ?? 0) >= 0.5) continue;
    // Real passports often put their English label after a local-language
    // label ("… / Surname") and use spaces instead of a colon.
    const match = text.match(new RegExp(`(?:^|\\n|/)\\s*${label}(?:\\s*[:/]\\s*|\\s*\\n\\s*|[ \\t]+)([^\\n]+)`, "i"));
    if (!match) continue;
    const raw = match[1].trim();
    if (key.endsWith("Date") || key === "dateOfBirth") {
      const numeric = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
      const candidate = numeric ? `${numeric[3]}-${numeric[2]}-${numeric[1]}` : raw;
      if (/^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0, 10) === candidate)
        put(key, candidate, 0.5);
    } else put(key, raw, 0.5);
  }
  return { fields, confidence };
}

/** A better OCR pass supplements a result; it must not erase already read fields. */
export function mergeDocumentRecognitions(...results: DocumentRecognition[]): DocumentRecognition {
  const merged: DocumentRecognition = { fields: { ...emptyIdentity }, confidence: {} };
  for (const result of results) {
    for (const key of Object.keys(emptyIdentity) as IdentityField[]) {
      const score = result.confidence[key] ?? 0;
      if (result.fields[key] && (merged.confidence[key] === undefined || score > merged.confidence[key]!)) {
        (merged.fields as Record<string, string>)[key] = result.fields[key];
        merged.confidence[key] = score;
      }
    }
  }
  return merged;
}
