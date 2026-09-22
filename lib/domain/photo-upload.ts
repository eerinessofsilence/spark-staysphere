export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_GALLERY_PHOTOS = 30;

/** Uploads are decoded and re-encoded by the browser; never trust the declared MIME or dimensions. */
export function webpDimensions(bytes: ArrayBuffer): { width: number; height: number } | null {
  const data = new Uint8Array(bytes);
  const text = (start: number, end: number) => String.fromCharCode(...data.slice(start, end));
  if (data.length < 30 || text(0, 4) !== "RIFF" || text(8, 12) !== "WEBP") return null;
  const view = new DataView(bytes);
  if (view.getUint32(4, true) + 8 !== data.length) return null;
  const kind = text(12, 16);
  let width = 0;
  let height = 0;
  if (kind === "VP8X") {
    if (data[20]! & 2) return null;
    width = 1 + data[24]! + (data[25]! << 8) + (data[26]! << 16);
    height = 1 + data[27]! + (data[28]! << 8) + (data[29]! << 16);
  } else if (kind === "VP8 " && data[23] === 0x9d && data[24] === 1 && data[25] === 0x2a) {
    width = view.getUint16(26, true) & 0x3fff;
    height = view.getUint16(28, true) & 0x3fff;
  } else if (kind === "VP8L" && data[20] === 0x2f) {
    const bits = view.getUint32(21, true);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
  }
  return width > 0 && height > 0 && width <= 4096 && height <= 4096 ? { width, height } : null;
}
