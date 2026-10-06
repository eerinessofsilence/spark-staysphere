export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_GALLERY_PHOTOS = 30;

const JPEG_START = [0xff, 0xd8];
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

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

/** Read JPEG dimensions without decoding the image, including Safari's fallback output. */
export function jpegDimensions(bytes: ArrayBuffer): { width: number; height: number } | null {
  const data = new Uint8Array(bytes);
  if (data.length < 4 || data[0] !== JPEG_START[0] || data[1] !== JPEG_START[1]) return null;
  const view = new DataView(bytes);
  let offset = 2;
  while (offset + 3 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset++];
    if (marker === undefined) return null;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= data.length) return null;
    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > data.length) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && segmentLength >= 7) {
      const height = view.getUint16(offset + 3, false);
      const width = view.getUint16(offset + 5, false);
      return width > 0 && height > 0 && width <= 4096 && height <= 4096 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

/** Read PNG dimensions from its IHDR chunk. */
export function pngDimensions(bytes: ArrayBuffer): { width: number; height: number } | null {
  const data = new Uint8Array(bytes);
  if (data.length < 24 || !PNG_SIGNATURE.every((value, index) => data[index] === value)) return null;
  const view = new DataView(bytes);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 && width <= 4096 && height <= 4096 ? { width, height } : null;
}

/** Validate the bytes as the declared browser output type and derive safe dimensions. */
export function imageDimensions(bytes: ArrayBuffer, contentType: string): { width: number; height: number } | null {
  if (contentType === 'image/webp') return webpDimensions(bytes);
  if (contentType === 'image/jpeg') return jpegDimensions(bytes);
  if (contentType === 'image/png') return pngDimensions(bytes);
  return null;
}
