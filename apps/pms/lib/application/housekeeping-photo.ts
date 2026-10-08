export type HousekeepingPhotoErrorCode = 'invalid_type' | 'decode_failed' | 'processing_failed' | 'too_large' | 'read_failed';

/** Callers translate `code` themselves — this module has no presentation strings of its own. */
export class HousekeepingPhotoError extends Error {
  constructor(public readonly code: HousekeepingPhotoErrorCode) {
    super(code);
  }
}

/** Downsize camera images before upload or offline storage; D1 keeps a compact evidence copy. */
export async function prepareHousekeepingPhoto(file: File, maxDimension = 1200): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new HousekeepingPhotoError('invalid_type');
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let close: () => void;
  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap; width = bitmap.width; height = bitmap.height; close = () => bitmap.close();
  } catch {
    // Use the same platform-decoder fallback as the room photo uploader on iOS.
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new HousekeepingPhotoError('decode_failed'));
        element.src = url;
      });
      source = image; width = image.naturalWidth; height = image.naturalHeight; close = () => URL.revokeObjectURL(url);
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) { close(); throw new HousekeepingPhotoError('processing_failed'); }
  try { context.drawImage(source, 0, 0, canvas.width, canvas.height); }
  finally { close(); }
  let blob: Blob | null = null;
  for (const quality of [0.7, 0.55, 0.4]) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= 700_000) break;
  }
  if (!blob || blob.size > 700_000) throw new HousekeepingPhotoError('too_large');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new HousekeepingPhotoError('read_failed'));
    reader.readAsDataURL(blob);
  });
}
